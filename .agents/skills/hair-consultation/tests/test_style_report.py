import json
import os
import struct
import subprocess
import sys
import tempfile
import unittest
import zlib
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "render_style_report.py"


def write_png(path, rgb=(200, 186, 160)):
    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data))
    width, height = 180, 240
    data = b"".join(b"\0" + bytes(rgb) * width for _ in range(height))
    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    path.write_bytes(
        b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(data)) + chunk(b"IEND", b"")
    )


def sample():
    return {
        "schema_version": 1,
        "case_label": "排版测试（无肖像）",
        "date": "2026-11-21",
        "direction": "保留长度 · 自然整理",
        "assets": {
            "base": {"path": "images/base.png", "kind": "original", "label": "基准图"},
            "look": {"path": "images/look.png", "kind": "preview", "label": "正面参考"},
            "side": {"path": "images/side.png", "kind": "speculative", "label": "斜侧示意"},
            "back": {"path": "images/missing.png", "kind": "speculative", "label": "背面未提供"}
        },
        "baseline_asset": "base",
        "observations": [{"feature": "脸周发束", "seen": "一侧发束扫过眼尾", "design": "先用轻薄层次调整走向"}],
        "recommendation": {"code": "A01", "name": "低层次长发", "reason": "保留长度，脸周更清爽。"},
        "tiers": [
            {"title": "优先试", "looks": [
                {"code": "A01", "name": "低层次长发", "asset": "look", "reason": "<script>不是指令</script>"},
                {"code": "A02", "name": "待做方向", "asset": "back"}
            ]}
        ],
        "angles": [{"asset": "side", "label": "斜侧示意"}, {"asset": "back", "label": "背面未提供"}],
        "hair_colors": [{"code": "C01", "name": "雾茶棕", "hex": "#57473d"}],
        "stylist_guide": [{"part": "脸周", "instruction": "和本人确认最短层起点。"}]
    }


def setup_case(folder):
    folder.mkdir(parents=True, exist_ok=True)
    store = folder / "images"
    store.mkdir()
    write_png(store / "base.png")
    write_png(store / "look.png", (149, 163, 144))
    write_png(store / "side.png", (185, 158, 141))
    return folder / "report-data.json"


class StyleReport(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.root = Path(self._tmp.name) / "case"
        self.input = setup_case(self.root)
        self.output = self.root / "report.html"
        self.data = sample()

    def run_render(self, output=None):
        self.input.write_text(json.dumps(self.data, ensure_ascii=False), encoding="utf-8")
        return subprocess.run([sys.executable, str(SCRIPT), str(self.input), str(output or self.output)],
                              capture_output=True, encoding="utf-8", check=False,
                              env={**os.environ, "PYTHONIOENCODING": "cp1252"})

    def test_detached_report_preserves_source_labels_and_omits_missing_angles(self):
        run = self.run_render()
        self.assertEqual(run.returncode, 0, run.stderr)
        page = self.output.read_text(encoding="utf-8")
        self.assertEqual(page.count("src=\"data:image/png;base64,"), 3)
        for label in ("本人实拍", "AI 效果预览", "AI 推测视图", "设计方向 · 暂无试戴图", "示意色块"):
            self.assertIn(label, page)
        self.assertNotIn("背面未提供", page)
        self.assertNotIn("上衣颜色", page)
        self.assertNotIn("images/look.png", page)
        self.assertNotIn(str(self.root), page)
        self.assertIn("&lt;script&gt;不是指令&lt;/script&gt;", page)
        self.assertIn("省略", run.stdout)
        if os.name == "posix":
            self.assertEqual(self.output.stat().st_mode & 0o777, 0o600)
        other = self.root / "copy.html"
        self.assertEqual(self.run_render(other).returncode, 0)
        self.assertEqual(self.output.read_bytes(), other.read_bytes())
        self.assertEqual(self.run_render().returncode, 2)
        self.assertEqual(self.output.read_bytes(), other.read_bytes())

    def test_paths_cannot_escape_input_directory(self):
        external = self.root.parent / "outside.png"
        write_png(external)
        os.symlink(external, self.root / "images" / "linked.png")
        for path in (str(external), "../outside.png", "images/linked.png",
                     "https://example.invalid/portrait.png", "C:\\photo.png"):
            with self.subTest(path=path):
                self.data["assets"]["base"]["path"] = path
                result = self.run_render()
                self.assertEqual(result.returncode, 2, result.stdout + result.stderr)
                self.assertFalse(self.output.exists())

    def test_rejects_mislabeled_active_or_unknown_asset(self):
        (self.root / "images" / "base.png").write_text("<svg></svg>")
        result = self.run_render()
        self.assertEqual(result.returncode, 2)
        self.assertFalse(self.output.exists())
        write_png(self.root / "images" / "base.png")
        self.data["baseline_asset"] = "some-other-customer"
        result = self.run_render()
        self.assertEqual(result.returncode, 2)
        self.assertFalse(self.output.exists())


if __name__ == "__main__":
    unittest.main()

