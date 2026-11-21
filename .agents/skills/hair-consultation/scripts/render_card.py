#!/usr/bin/env python3
"""Render a private haircut communication card from accepted existing assets."""

import argparse
import base64
import hashlib
import html
import json
from pathlib import Path
import sys
import uuid


def image_uri(root, asset):
    relative = Path(asset["path"])
    if relative.is_absolute():
        raise ValueError("图片必须使用案例内相对路径")
    path = (root / relative).resolve()
    if not path.is_relative_to(root):
        raise ValueError("图片路径越出本案例")
    if path.stat().st_size > 20 * 1024 * 1024:
        raise ValueError("图片超过 20 MiB，请先提供适当大小的副本")
    data = path.read_bytes()
    if hashlib.sha256(data).hexdigest() != asset.get("sha256"):
        raise ValueError("图片 hash 不匹配，请核对来源")
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        mime = "image/png"
    elif data.startswith(b"\xff\xd8\xff"):
        mime = "image/jpeg"
    elif data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        mime = "image/webp"
    else:
        raise ValueError("仅支持 PNG、JPEG、WebP 图片")
    return f"data:{mime};base64," + base64.b64encode(data).decode("ascii")


def esc(value):
    if isinstance(value, list):
        value = "；".join(str(x) for x in value if x)
    return "待现场确认" if value is None or value == "" else html.escape(str(value))


def render(case_file):
    case_file = Path(case_file).resolve()
    root = case_file.parent
    case = json.loads(case_file.read_text(encoding="utf-8"))
    if case.get("schema_version") != "1.0" or not case.get("case_id"):
        raise ValueError("缺少有效的版本或案例 ID")
    auth = case.get("authorization", {})
    if auth.get("portrait_authorized") is not True or auth.get("cloud_processing_approved") is not True:
        raise ValueError("尚未记录照片使用与本次云端处理授权")
    assets = case.get("assets", [])
    ids = [a["id"] for a in assets]
    if len(ids) != len(set(ids)):
        raise ValueError("资源 ID 重复")
    originals = [a for a in assets if a.get("kind") == "original" and a.get("view") == "front"]
    if len(originals) != 1:
        raise ValueError("需要唯一的真实正面原照")
    selection = case.get("selection", {})
    if selection.get("customer_confirmed") is not True:
        raise ValueError("顾客尚未确认最终结果")
    selected = next((a for a in assets if a["id"] == selection.get("asset_id")), None)
    if not selected or selected.get("kind") != "generated" or selected.get("layout") != "single" or selected.get("view") != "front":
        raise ValueError("选择必须对应正面单款预览文件")
    if not selection.get("option_id") or selected.get("option_id") != selection["option_id"]:
        raise ValueError("最终图片与所选款式编号不一致")
    review = selected.get("review", {})
    if review.get("visual") != "accepted" or review.get("identity") != "customer_confirmed":
        raise ValueError("最终预览尚未通过视觉与本人确认")
    options = [o for o in case.get("options", []) if o.get("id") == selection["option_id"]]
    if len(options) != 1:
        raise ValueError("所选款式记录缺失或重复")
    before, after = image_uri(root, originals[0]), image_uri(root, selected)
    info = case.get("communication", {})
    labels = [("fringe", "刘海"), ("sides", "两侧"), ("crown", "顶部"),
              ("ear_area", "耳周"), ("nape", "后颈"), ("keep", "希望保留"),
              ("avoid", "希望避免"), ("care", "日常打理"), ("services", "所需服务"), ("price", "报价")]
    rows = "".join(f"<tr><th>{label}</th><td>{esc(info.get(key))}</td></tr>" for key, label in labels)
    feasibility = case.get("feasibility", {})
    status = {"unreviewed": "待理发师确认", "needs_more_info": "需要补充信息", "stylist_confirmed": "已记录理发师确认"}.get(feasibility.get("status"))
    if status is None:
        raise ValueError("理发师可行性状态无效")
    title = f"{esc(selection['option_id'])} · {esc(options[0].get('name'))}"
    document = f"""<!doctype html>
<html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>剪前发型沟通卡</title>
<style>
*{{box-sizing:border-box}}body{{margin:0;background:#f3f0e8;color:#292824;font-family:system-ui,-apple-system,sans-serif}}
main{{max-width:1000px;margin:auto;padding:32px}}h1{{font-size:30px;margin:8px 0}}h2{{font-size:22px;overflow-wrap:anywhere}}p{{line-height:1.6}}
.eyebrow{{font-size:13px;color:#686052}}.photos{{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin:24px 0}}
figure{{margin:0;background:#fff;border-radius:12px;overflow:hidden}}img{{width:100%;height:390px;object-fit:contain;display:block;background:#e9e5dc}}
figcaption{{padding:12px 16px;font-size:15px}}.badge{{display:inline-block;padding:6px 10px;border:1px solid #b9b09e;border-radius:20px;font-size:13px}}
table{{width:100%;border-collapse:collapse;background:#fffcf6;table-layout:fixed}}th,td{{padding:12px;border-bottom:1px solid #ddd6c8;text-align:left;vertical-align:top;overflow-wrap:anywhere}}
th{{width:110px;color:#655c4b;font-weight:500}}.note{{font-size:13px;color:#655c4b}}.confirm{{margin-top:24px;padding:16px;border:1px solid #c7bead;border-radius:10px}}
@media(max-width:540px){{main{{padding:18px}}h1{{font-size:25px}}.photos{{gap:8px}}img{{height:230px}}figcaption{{padding:9px;font-size:13px}}th{{width:85px}}th,td{{padding:10px}}}}
@media print{{body{{background:white}}main{{padding:0}}img{{height:300px}}figure,.confirm,tr{{break-inside:avoid}}}}
</style>
<main><p class="eyebrow">剪前造型笔记 · 顾客选择记录</p><h1>剪前发型沟通卡</h1>
<h2>{title}</h2><span class="badge">顾客已确认预览中的本人形象</span>
<div class="photos"><figure><img src="{before}" alt="顾客真实原照"><figcaption>真实原照</figcaption></figure>
<figure><img src="{after}" alt="选定发型的 AI 效果预览"><figcaption>AI效果预览 · {esc(selection['option_id'])}</figcaption></figure></div>
<table>{rows}</table><div class="confirm"><strong>{status}</strong><p>{esc(feasibility.get('notes'))}</p>
<p>现场确认：实际长度、发旋、发况、烫染史、服务条件及报价。</p></div>
<p class="note">用于剪前沟通参考。AI效果预览不代表实际理发作品，最终实施以现场确认为准。</p>
</main></html>"""
    reports = root / "reports"
    if reports.is_symlink():
        raise ValueError("报告目录不能是符号链接")
    reports.mkdir(mode=0o700, exist_ok=True)
    output = reports / f"communication-card-{uuid.uuid4().hex[:12]}.html"
    with output.open("x", encoding="utf-8") as handle:
        output.chmod(0o600)
        handle.write(document)
    return output


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding='utf-8', errors='backslashreplace')
    sys.stderr.reconfigure(encoding='utf-8', errors='backslashreplace')
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("case_json", help="Private case.json with confirmed final preview")
    args = parser.parse_args()
    try:
        print(render(args.case_json))
    except (ValueError, OSError, KeyError, TypeError) as error:
        print(f"无法生成沟通卡：{error}", file=sys.stderr)
        sys.exit(1)
