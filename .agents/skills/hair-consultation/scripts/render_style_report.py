#!/usr/bin/env python3
"""Render a private, offline hairstyle report from structured text and local images."""
from __future__ import annotations

import argparse
import base64
import html
import json
import os
import re
import stat
import sys
from dataclasses import dataclass
from pathlib import Path, PureWindowsPath


SOURCE = {
    "original": "本人实拍",
    "baseline": "AI 整理基准照",
    "preview": "AI 效果预览",
    "speculative": "AI 推测视图",
}
IMAGE_EXTENSIONS = {".jpg": "jpeg", ".jpeg": "jpeg", ".png": "png", ".webp": "webp"}
IMAGE_LIMIT = 12 * 1024 * 1024
TOTAL_LIMIT = 80 * 1024 * 1024


class ReportError(ValueError):
    pass


def esc(value: str) -> str:
    return html.escape(value, quote=True)


def plain(row: dict, field: str, default: str = "", *, limit: int = 600) -> str:
    value = row.get(field, default)
    if not isinstance(value, str) or len(value) > limit:
        raise ReportError(f"{field} 必须是 {limit} 字以内的文本。")
    return value.strip()


def object_rows(row: dict, field: str, limit: int) -> list[dict]:
    rows = row.get(field, [])
    if not isinstance(rows, list) or len(rows) > limit or not all(isinstance(item, dict) for item in rows):
        raise ReportError(f"{field} 必须是最多 {limit} 项的对象列表。")
    return rows


def private_path(root: Path, value: str) -> Path:
    path = Path(value)
    win = PureWindowsPath(value)
    if not value or path.is_absolute() or win.drive or win.root or "\\" in value:
        raise ReportError("图片路径必须是相对于本案例目录的本地文件路径。")
    if ":" in value or ".." in path.parts or any(part.startswith(".") for part in path.parts):
        raise ReportError("图片路径不得指向外部、上级或隐藏目录。")
    path = (root / path).resolve()
    if not path.is_relative_to(root) or path == root:
        raise ReportError("图片路径越过案例目录。")
    return path


def media_type(path: Path, data: bytes) -> str:
    found = None
    if data.startswith(b"\x89PNG\r\n\x1a\n") and data[12:16] == b"IHDR" and len(data) >= 45:
        found = "png"
    elif data.startswith(b"\xff\xd8\xff") and len(data) >= 12:
        found = "jpeg"
    elif data.startswith(b"RIFF") and data[8:12] == b"WEBP" and len(data) >= 20:
        found = "webp"
    if not found or found != IMAGE_EXTENSIONS.get(path.suffix.lower()):
        raise ReportError("素材须为有效的 PNG、JPEG 或 WebP，文件名后缀与格式需要一致。")
    return f"image/{found}"


@dataclass(frozen=True)
class Image:
    label: str
    source: str
    uri: str | None


class Images:
    def __init__(self, root: Path, specs: object) -> None:
        if not isinstance(specs, dict) or len(specs) > 64:
            raise ReportError("assets 必须是最多 64 项的对象。")
        self.items: dict[str, Image] = {}
        self.missing = 0
        self._bytes = 0
        self._embedded = 0
        cache: dict[Path, str] = {}
        for key, asset in specs.items():
            if not re.fullmatch(r"[A-Za-z0-9_-]{1,40}", key) or not isinstance(asset, dict):
                raise ReportError("素材 ID 只允许 1–40 个字母、数字、下划线或短横线。")
            kind = plain(asset, "kind", limit=30)
            if kind not in SOURCE:
                raise ReportError("素材 kind 须为 original、baseline、preview 或 speculative。")
            label = plain(asset, "label", SOURCE[kind], limit=100) or SOURCE[kind]
            path = private_path(root, plain(asset, "path", limit=350))
            if path.suffix.lower() not in IMAGE_EXTENSIONS:
                raise ReportError("仅允许 PNG、JPEG、WebP 图片。")
            if not path.exists():
                self.missing += 1
                self.items[key] = Image(label, SOURCE[kind], None)
                continue
            if path not in cache:
                info = path.stat()
                if not stat.S_ISREG(info.st_mode) or info.st_size > IMAGE_LIMIT:
                    raise ReportError("素材必须为常规图片文件，单张不能超过 12 MiB。")
                if self._bytes + info.st_size > TOTAL_LIMIT:
                    raise ReportError("素材超过 80 MiB；请使用保留完整发型轮廓的展示副本。")
                with path.open("rb") as stream:
                    data = stream.read(IMAGE_LIMIT + 1)
                if len(data) > IMAGE_LIMIT or self._bytes + len(data) > TOTAL_LIMIT:
                    raise ReportError("素材超过大小限制。")
                cache[path] = "data:" + media_type(path, data) + ";base64," + base64.b64encode(data).decode("ascii")
                self._bytes += len(data)
            self.items[key] = Image(label, SOURCE[kind], cache[path])

    def get(self, row: dict) -> Image | None:
        key = plain(row, "asset", limit=40)
        if not key:
            return None
        if key not in self.items:
            raise ReportError(f"未声明素材 ID：{key}")
        image = self.items[key]
        if image.uri is None:
            return None
        self._embedded += len(image.uri)
        if self._embedded > 120 * 1024 * 1024:
            raise ReportError("报告内嵌素材超过 120 MiB；请减小展示副本或避免重复使用大图。")
        return image


STYLE = r"""
:root{color-scheme:light;--paper:#f8f3e8;--white:#fffcf6;--ink:#27352e;--mid:#4c5c50;--moss:#334b3c;--line:#ded8ca;--light:#e6e0d1;--accent:#806b49;
font:15px/1.65 -apple-system,BlinkMacSystemFont,"PingFang SC","Noto Sans CJK SC",sans-serif;background:#eae5d9;color:var(--ink)}
*{box-sizing:border-box}body{margin:0}main{max-width:1120px;margin:26px auto;padding:0 38px 36px;background:var(--paper);border-top:4px solid var(--moss)}p,figure{margin:0}a{color:inherit}button{font:inherit}
h1,h2,h3{font-family:"Songti SC","Noto Serif CJK SC",serif;line-height:1.22;margin:0}
h1{font-size:clamp(36px,6vw,64px);font-weight:800;letter-spacing:.015em}
h2{font-size:clamp(23px,3vw,32px)}h3{font-size:20px;overflow-wrap:anywhere}
.meta{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;border-bottom:1px solid var(--line);padding:12px 0;color:var(--mid);font-size:12px;letter-spacing:.08em}
header,.part{min-width:0}.intro{padding:25px 0 20px}.intro p{margin-top:8px;font-size:14px;color:var(--mid);overflow-wrap:anywhere}
.lead{padding:13px 15px;border-radius:4px;background:var(--moss);color:#fffbef;display:grid;gap:3px}.lead b{font-size:20px}
.lead span{font-size:12px;color:#ecede1}.lead p{font-size:13px}
.part{border-top:1px solid var(--line);padding-top:13px;margin-top:23px}
.part-title{display:flex;align-items:baseline;gap:10px;margin-bottom:12px}
.number{color:var(--accent);font-size:13px;letter-spacing:.03em;font-weight:700;white-space:nowrap}
.baseline-alone{width:min(100%,240px)}.split{display:grid;grid-template-columns:minmax(120px,230px) minmax(0,1fr);gap:13px;align-items:start}
.observations{list-style:none;padding:0;margin:0;display:grid;gap:6px}.observations li,.guide li{background:var(--white);border:1px solid var(--line);padding:8px 11px;border-radius:4px;overflow-wrap:anywhere}
.observations b{font-size:13px}.observations p{font-size:13px;color:var(--mid)}.observations p+p{color:var(--ink)}
.tier{margin:11px 0 18px}.tier h3{font-size:17px;padding-bottom:7px;color:var(--mid)}
.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;align-items:start}
.card,figure{min-width:0}.card{border:1px solid var(--line);background:var(--white);border-radius:5px;overflow:hidden}
.card-body{padding:10px}.card p{margin-top:4px;font-size:13px;color:var(--mid);overflow-wrap:anywhere}
.code,.source,.category{font-size:11px;color:var(--mid);letter-spacing:.045em}.pending{color:#785839}
.zoom{display:block;padding:0;border:0;width:100%;cursor:zoom-in;background:#eae3d8}img{display:block;max-width:100%}
.zoom img{aspect-ratio:3/4;object-fit:contain;width:100%;height:auto}
figcaption{display:grid;gap:1px;padding:6px 8px;color:var(--mid);font-size:12px;background:#f0e9dc;overflow-wrap:anywhere}
.swatch{width:18px;height:18px;vertical-align:-4px;margin-right:7px;border:1px solid #0003;border-radius:50%;display:inline-block}
.guide{padding:0;margin:0;list-style:none;display:grid;gap:6px}
.note{margin-top:9px;color:var(--mid);font-size:12px;overflow-wrap:anywhere}
footer{margin-top:22px;padding-top:9px;border-top:1px solid var(--line);color:var(--mid);font-size:11px}
dialog{width:min(840px,calc(100% - 22px));border:0;border-radius:6px;background:var(--white);color:var(--ink);padding:9px}
dialog::backdrop{background:#202820d9}.large-picture{max-height:75vh;margin:5px auto;object-fit:contain}
.viewer-head{display:flex;justify-content:space-between;gap:8px;align-items:center}.viewer-head button{padding:3px 9px;border-radius:3px;border:1px solid var(--line);background:var(--paper);cursor:pointer}
button:focus-visible{outline:2px solid #4a6652;outline-offset:-2px}
@media(max-width:700px){main{margin:0;padding:0 15px 24px}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.split{grid-template-columns:minmax(100px,33%) minmax(0,1fr)}}
@media(max-width:365px){.split{grid-template-columns:1fr}.split>figure .zoom img{width:min(100%,190px);margin-inline:auto}.card-body{padding:7px}.grid{gap:7px}}
@media print{@page{size:A4 portrait;margin:10mm}:root{background:white;font-size:12px}main{margin:0;max-width:none;padding:0;border:0}.intro{padding:14px 0}.part{margin-top:15px}.grid{grid-template-columns:repeat(3,minmax(0,1fr))}.card,figure,.lead,.guide li{break-inside:avoid}.part-title,.tier h3{break-after:avoid}.zoom img{max-height:95mm}.split .zoom img{max-height:70mm}dialog,.screen-only{display:none!important}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
"""

VIEWER = r"""
<dialog id="gallery" aria-labelledby="viewer-label">
  <form method="dialog" class="viewer-head"><strong id="viewer-label"></strong><button type="submit">关闭（Esc）</button></form>
  <img class="large-picture" alt="">
</dialog>
<script>
const gallery = document.getElementById('gallery');
const enlarged = gallery.querySelector('img');
document.querySelectorAll('button.zoom').forEach(button => button.addEventListener('click', () => {
  const photo = button.querySelector('img');
  if (!gallery.open) {
    gallery.querySelector('strong').textContent = photo.alt;
    enlarged.src = photo.currentSrc || photo.src;
    enlarged.alt = photo.alt;
    gallery.showModal();
  }
}));
gallery.addEventListener('close', () => { enlarged.removeAttribute('src'); });
</script>
"""


def photo(image: Image, caption: str = "") -> str:
    label = caption or image.label
    alt = f"{label} · {image.source}"
    return (
        f'<figure><button type="button" class="zoom" aria-label="{esc(alt)}（放大）">'
        f'<img alt="{esc(alt)}" src="{image.uri}"></button><figcaption><span>{esc(label)}</span>'
        f'<span class="source">{esc(image.source)}</span></figcaption></figure>'
    )


def card(images: Images, row: dict, *, color: bool = False) -> str:
    image = images.get(row)
    name = plain(row, "name", limit=90)
    if not name:
        return ""
    code = plain(row, "code", limit=24)
    label = plain(row, "label", limit=90)
    reason = plain(row, "reason")
    care = plain(row, "care")
    swatch = plain(row, "hex", limit=7)
    if swatch and (not color or not re.fullmatch(r"#[0-9a-fA-F]{6}", swatch)):
        raise ReportError("色块必须使用 #RRGGBB。")
    badge = f'<p class="code">{esc(code)}</p>' if code else ""
    if not image:
        tag = "示意色块" if swatch else "设计方向 · 暂无试戴图"
        badge += f'<p class="code pending">{tag}</p>'
    chip = f'<i aria-hidden="true" class="swatch" style="background:{swatch}"></i>' if swatch else ""
    description = "".join(f"<p>{esc(value)}</p>" for value in (reason, care) if value)
    return (
        f'<article class="card">{photo(image, label) if image else ""}'
        f'<div class="card-body">{badge}<h3>{chip}{esc(name)}</h3>{description}</div></article>'
    )


def render(data: dict, root: Path) -> tuple[str, int]:
    if not isinstance(data, dict) or data.get("schema_version") != 1:
        raise ReportError("报告 JSON 的 schema_version 须为 1。")
    images = Images(root, data.get("assets", {}))
    title = plain(data, "title", "个人形象设计报告", limit=100) or "个人形象设计报告"
    label = plain(data, "case_label", limit=90)
    date = plain(data, "date", limit=24)
    direction = plain(data, "direction", limit=200)
    baseline = images.get({"asset": data.get("baseline_asset", "")})
    obs = ""
    for row in object_rows(data, "observations", 12):
        name, seen, action = (plain(row, key) for key in ("feature", "seen", "design"))
        if not seen:
            continue
        para = f"<b>{esc(name)}</b>" if name else ""
        para += f"<p>{esc(seen)}</p>"
        if action:
            para += f"<p>设计取舍：{esc(action)}</p>"
        obs += f"<li>{para}</li>"
    parts: list[tuple[str, str]] = []
    if obs or baseline:
        findings = f'<ul class="observations">{obs}</ul>' if obs else ""
        picture = photo(baseline) if baseline else ""
        if obs and baseline:
            content = f'<div class="split">{picture}{findings}</div>'
        else:
            content = f'<div class="baseline-alone">{picture}</div>' if picture else findings
        parts.append(("基准照与照片观察", content))
    tiers = ""
    for tier in object_rows(data, "tiers", 6):
        cards = "".join(card(images, row) for row in object_rows(tier, "looks", 24))
        if cards:
            tier_name = plain(tier, "title", limit=90)
            heading = f"<h3>{esc(tier_name)}</h3>" if tier_name else ""
            tiers += f'<div class="tier">{heading}<div class="grid">{cards}</div></div>'
    if tiers:
        parts.append(("发型对照", tiers))
    angles = ""
    for row in object_rows(data, "angles", 5):
        image = images.get(row)
        if image:
            angles += photo(image, plain(row, "label", limit=80))
    if angles:
        detail = plain(data, "angles_note")
        note = f'<p class="note">{esc(detail)}</p>' if detail else ""
        parts.append(("首选发型角度", f'<div class="grid">{angles}</div>{note}'))
    for field, heading in (("hair_colors", "发色对照"), ("garment_colors", "上衣颜色")):
        cards = "".join(card(images, row, color=True) for row in object_rows(data, field, 18))
        if cards:
            text = plain(data, field + "_note")
            note = f'<p class="note">{esc(text)}</p>' if text else ""
            parts.append((heading, f'<div class="grid">{cards}</div>{note}'))
    guide = ""
    for row in object_rows(data, "stylist_guide", 12):
        field, value = plain(row, "part", limit=70), plain(row, "instruction")
        if field and value:
            guide += f"<li><strong>{esc(field)}：</strong>{esc(value)}</li>"
    if guide:
        parts.append(("带去和发型师确认", f'<ul class="guide">{guide}</ul>'))
    recommendation = data.get("recommendation", {})
    if not isinstance(recommendation, dict):
        raise ReportError("recommendation 必须是对象。")
    rec_name = plain(recommendation, "name", limit=90)
    rec_code = plain(recommendation, "code", limit=24)
    rec_reason = plain(recommendation, "reason")
    lead = ""
    if rec_name:
        lead = f'<div class="lead"><span>首选方向 · 供本人挑选</span><b>{esc(" ".join(x for x in (rec_code, rec_name) if x))}</b>'
        if rec_reason:
            lead += f"<p>{esc(rec_reason)}</p>"
        lead += "</div>"
    if not (parts or lead):
        raise ReportError("模板还没有内容。至少填写照片观察、发型建议或一项已备素材。")
    sections = "".join(
        f'<section class="part"><div class="part-title"><span class="number">{index:02d}</span>'
        f'<h2>{name}</h2></div>{content}</section>'
        for index, (name, content) in enumerate(parts, 1)
    )
    tagline = " · ".join(filter(None, (label, direction)))
    limitation = plain(data, "limitations")
    foot = (
        '<footer><b>剪前沟通参考</b> · AI 预览或推测视图不等于实剪、实染。'
        '<span class="screen-only">　可点图放大，浏览器可打印或保存 PDF。</span>'
        + (f'<p class="note">{esc(limitation)}</p>' if limitation else '') + '</footer>'
    )
    disclaimer = "　·　" + esc(date) if date else ""
    return (
        '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        '<meta content="no-referrer" name="referrer">'
        f'<title>{esc(title)} · 剪前看看</title><style>{STYLE}</style></head><body><main>'
        f'<header><div class="meta"><b>剪前看看　/　个人造型档案</b><span>AI 效果预览{disclaimer}</span></div>'
        f'<div class="intro"><h1>{esc(title)}</h1>{("<p>" + esc(tagline) + "</p>") if tagline else ""}</div>{lead}'
        f'</header>{sections}{foot}</main>{VIEWER}</body></html>\n',
        images.missing,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="案例私有目录中的报告 JSON")
    parser.add_argument("output", type=Path, help="新的 .html 文件；不覆盖旧报告")
    args = parser.parse_args()
    try:
        source = args.input.resolve(strict=True)
        info = source.stat()
        if source.suffix.lower() != ".json" or not stat.S_ISREG(info.st_mode):
            raise ReportError("输入须为案例目录中的 JSON 文件。")
        if info.st_size > 1_048_576:
            raise ReportError("报告 JSON 最大 1 MiB。")
        if args.output.suffix.lower() != ".html":
            raise ReportError("输出文件后缀必须是 .html。")
        data = json.loads(source.read_text(encoding="utf-8"))
        rendered, omitted = render(data, source.parent)
        fd = os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        try:
            with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as out:
                out.write(rendered)
        except OSError:
            args.output.unlink(missing_ok=True)
            raise
    except FileExistsError:
        print("报告未写入：输出文件已存在，请为新版本另选文件名。", file=sys.stderr)
        return 2
    except (ReportError, OSError, RuntimeError, ValueError) as exc:
        print(f"报告未写入：{exc}", file=sys.stderr)
        return 2
    print(f"已生成报告：{args.output}")
    if omitted:
        print(f"省略无法读取的可选素材：{omitted}。")
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding='utf-8', errors='backslashreplace')
    sys.stderr.reconfigure(encoding='utf-8', errors='backslashreplace')
    raise SystemExit(main())

