"""Lay out existing, authorized portrait outputs; never retouch or generate a face.

Usage: python3 render_lookbook.py SOURCE_BATCH OUTPUT_DIRECTORY
SOURCE_BATCH contains look-plan.json and assets/00-faithful-baseline.png.
Optional presentation-plan.json supplies customer-facing copy and recommendations.
"""
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw, ImageFont
import argparse
import hashlib
import html
import json
import math
import os
import shutil

def default_font():
    custom = os.getenv("JQQ_CJK_FONT")
    if custom:
        return custom
    win = Path(os.getenv("WINDIR") or "C:/Windows") / "Fonts"
    for candidate in (
        win / "msyh.ttc",
        win / "simsun.ttc",
        Path("/System/Library/Fonts/Hiragino Sans GB.ttc"),
        Path("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"),
    ):
        if candidate.is_file():
            return str(candidate)
    raise ValueError("请把 JQQ_CJK_FONT 设为支持中文的 .ttf、.otf 或 .ttc 字体文件路径。")

BG, INK, MUTED, LINE, ACCENT = '#f6f3ed', '#27332e', '#626b65', '#dcded5', '#365747'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def font(size, bold=False):
    path = default_font()
    index = 1 if bold and path.endswith("Hiragino Sans GB.ttc") else 0
    try:
        return ImageFont.truetype(path, size, index=index)
    except OSError as exc:
        raise ValueError("请检查 JQQ_CJK_FONT 指向的中文字体能否读取。") from exc


def wrap(draw, text, typeface, width):
    lines, line = [], ''
    for char in text:
        if char == '\n' or draw.textlength(line + char, font=typeface) > width:
            lines.append(line)
            line = '' if char == '\n' else char
        else:
            line += char
    if line:
        lines.append(line)
    return lines


def draw_text(draw, xy, text, size, width, color=INK, bold=False):
    x, y = xy
    typeface = font(size, bold)
    for line in wrap(draw, text, typeface, width):
        draw.text((x, y), line, font=typeface, fill=color)
        y += round(size * 1.55)
    return y


def secure_source(root, relative):
    path = (root / relative).resolve()
    if not path.is_relative_to(root) or not path.is_file():
        raise ValueError(f'Invalid source asset: {relative}')
    return path


def make_preview(source, target, crop_normalized, is_baseline=False):
    with Image.open(source) as im:
        im = ImageOps.exif_transpose(im).convert('RGB')
        w, h = im.size
        # One common framing for this aligned portrait batch. No face-dependent warp,
        # sharpening, exposure, skin retouch, or generative changes occur here.
        box = tuple(round((w if n % 2 == 0 else h)*v) for n,v in enumerate(crop_normalized))
        im = ImageOps.pad(im.crop(box), (800, 1000), method=Image.Resampling.LANCZOS, color='#ece6e0')
        draw = ImageDraw.Draw(im)
        label = 'AI处理基准' if is_baseline else 'AI效果预览'
        f = font(20)
        tw = draw.textlength(label, font=f)
        draw.rounded_rectangle((760-tw-18, 947, 780, 984), radius=8, fill='#f8f5ef')
        draw.text((760-tw, 952), label, font=f, fill=INK)
        im.save(target, quality=94, subsampling=0)
    return list(box)


def make_board(out, looks, filename, title, subtitle, columns, width):
    pad, gap = 56, 28
    tile_w = (width - pad*2 - gap*(columns-1)) // columns
    photo_h = round(tile_w * 1.25)
    caption_h = 155 if columns == 4 else 250
    tile_h = photo_h + caption_h
    header_h, footer_h = 228, 106
    rows = math.ceil(len(looks)/columns)
    height = header_h + rows*tile_h + max(0, rows-1)*gap + footer_h
    board = Image.new('RGB', (width, height), BG)
    draw = ImageDraw.Draw(board)
    draw_text(draw, (pad, 32), '剪前看看  /  发型提案', 25, width-pad*2, MUTED)
    draw_text(draw, (pad, 85), title, 58, width-pad*2, bold=True)
    draw_text(draw, (pad, 174), subtitle, 27, width-pad*2, MUTED)
    for n, item in enumerate(looks):
        x = pad + n % columns * (tile_w+gap)
        y = header_h + n // columns * (tile_h+gap)
        draw.rounded_rectangle((x, y, x+tile_w, y+tile_h), radius=12, fill='#ffffff')
        with Image.open(out/item['preview']) as pic:
            pic = pic.resize((tile_w, photo_h), Image.Resampling.LANCZOS)
            board.paste(pic, (x, y))
        num_size, title_size, small = (38, 29, 23) if columns == 4 else (50, 38, 28)
        cy = y + photo_h + 15
        draw_text(draw, (x+18, cy), item['id'], num_size, 100, ACCENT, True)
        name_x = x + (86 if columns == 4 else 112)
        draw_text(draw, (name_x, cy+4), item['name'], title_size, tile_w-(name_x-x)-18, bold=True)
        draw_text(draw, (x+18, cy+64 if columns == 4 else cy+86), item['display_summary'], small, tile_w-36, MUTED)
        tag = ('优先比较' if item.get('recommended') else item['display_group']) if columns == 4 else '打理：'+item['care_note']
        draw_text(draw, (x+18, y+tile_h-42 if columns == 4 else y+photo_h+160), tag, small-2, tile_w-36, ACCENT)
    draw.line((pad, height-77, width-pad, height-77), fill=LINE, width=2)
    draw_text(draw, (pad, height-59), 'AI效果预览 · 可按编号选择；留长、烫发与打理条件请查看图册。', 24, width-pad*2, MUTED)
    board.save(out/filename, quality=95, subsampling=0)
    return {'file': filename, 'width': width, 'height': height, 'options': [i['id'] for i in looks]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    source, out = args.source.resolve(), args.output.resolve()
    if source == out:
        raise ValueError('Use a new output directory; preserve the previous delivery.')
    looks = json.loads((source/'look-plan.json').read_text())
    if not looks or len({i['id'] for i in looks}) != len(looks):
        raise ValueError('Require distinct option IDs.')
    copy_path = source/'presentation-plan.json'
    copy = json.loads(copy_path.read_text()) if copy_path.exists() else {}
    crop = copy.get('display_crop_normalized', [.065, .07, .935, .88])
    if len(crop) != 4 or not all(isinstance(v, (int,float)) and 0 <= v <= 1 for v in crop) or not (crop[0] < crop[2] and crop[1] < crop[3]):
        raise ValueError('display_crop_normalized must define a rectangle within [0,1].')
    for folder in ('assets', 'previews', 'prompts', 'evidence'):
        (out/folder).mkdir(parents=True, exist_ok=True, mode=0o700)
    baseline = secure_source(source, 'assets/00-faithful-baseline.png')
    shutil.copy2(baseline, out/'assets/00-faithful-baseline.png')
    baseline_box = make_preview(baseline, out/'previews/00.jpg', crop, True)
    hashes = [{'file': 'assets/00-faithful-baseline.png', 'source_sha256': digest(baseline)}]
    comparisons = {}
    for base in copy.get('comparison_bases', []):
        original = secure_source(source, base['image_path'])
        rel = 'assets/'+original.name
        shutil.copy2(original, out/rel)
        preview = 'previews/'+base['id']+'.jpg'
        make_preview(original, out/preview, crop, True)
        comparisons[base['id']] = {'preview': preview, 'label': base['label']}
        hashes.append({'file': rel, 'source_sha256': digest(original)})
    for item in looks:
        editorial = copy.get('options', {}).get(item['id'], {})
        item.update(editorial)
        item.setdefault('display_summary', item.get('personal_reason') or item.get('group', '发型探索'))
        item.setdefault('care_note', item.get('condition', '实施条件待理发师确认'))
        item.setdefault('display_group', item.get('group', '发型探索'))
        item.setdefault('category', 'natural')
        if item.get('comparison_key') in comparisons:
            reference = comparisons[item['comparison_key']]
            item['comparison_preview'], item['comparison_label'] = reference['preview'], reference['label']
        original = secure_source(source, item['image_path'])
        expected = item.get('image_sha256')
        if expected and digest(original) != expected:
            raise ValueError(f"Source hash mismatch: {item['id']}")
        item['image_path'] = 'assets/'+original.name
        shutil.copy2(original, out/item['image_path'])
        item['preview'] = f"previews/{item['id']}.jpg"
        item['display_crop_pixels'] = make_preview(original, out/item['preview'], crop)
        hashes.append({'file': item['image_path'], 'source_sha256': digest(original)})
        if item.get('prompt_path'):
            prompt = secure_source(source, item['prompt_path'])
            item['prompt_path'] = 'prompts/'+prompt.name
            shutil.copy2(prompt, out/item['prompt_path'])
    for extra in ('全部提示词.md', '发色来源与推荐依据.md'):
        if (source/extra).exists():
            shutil.copy2(source/extra, out/extra)
    boards = [make_board(out, looks, copy.get('overview_filename', '12款发型总览_清晰排版.jpg'), copy.get('overview_title', f"{len(looks)} 款发型，一起比较"), copy.get('overview_subtitle', '同一基准 · 同一构图 · 按编号选择'), 4, 2400)]
    by_id = {i['id']: i for i in looks}
    groups = copy.get('boards', [])
    if not groups:
        groups = [{'title': f'方案 {n+1}—{min(n+4,len(looks))}', 'ids': [i['id'] for i in looks[n:n+4]]} for n in range(0,len(looks),4)]
    for n, group in enumerate(groups, 1):
        chosen = [by_id[i] for i in group['ids']]
        boards.append(make_board(out, chosen, f"{n:02d}_{group['title']}_四款对比.jpg", group['title'], group.get('subtitle', '大图比较 · 以图册中的条件说明为准'), 2, 1800))
    for group in copy.get('extra_boards', []):
        boards.append(make_board(out, [by_id[i] for i in group['ids']], group['filename'], group['title'], group['subtitle'], group.get('columns',3), group.get('width',2400)))
    esc = lambda value: html.escape(str(value), quote=True)
    cards = []
    for item in looks:
        ident = esc(item['id'])
        badge = '<span class="recommend">优先比较</span>' if item.get('recommended') else ''
        attribution = ''
        if item.get('source_url', '').startswith('https://www.xiaohongshu.com/'):
            attribution = f'<p class="source"><a href="{esc(item["source_url"])}" target="_blank" rel="noopener">小红书参考出处 ↗</a><span>{esc(item.get("source_note","色调参考，不代表平台排名"))}</span></p>'
        cards.append(f'''<article class="look" data-id="{ident}" data-category="{esc(item['category'])}">
          <div class="look-title"><span class="number">{ident}</span><div><h3>{esc(item['name'])}</h3><span class="group">{esc(item['display_group'])}</span></div>{badge}</div>
          <button class="photo-button" data-open="{ident}" aria-label="放大 {ident} {esc(item['name'])}"><img src="{esc(item['preview'])}" alt="{ident} {esc(item['name'])}，AI效果预览" width="800" height="1000" loading="lazy"><span class="enlarge">查看大图 ↗</span></button>
          <div class="look-copy"><p class="summary">{esc(item['display_summary'])}</p><p class="care"><span>打理与条件</span>{esc(item['care_note'])}</p>{attribution}<button class="save" data-save="{ident}" aria-pressed="false">＋ 加入备选</button></div></article>''')
    board_links = ''.join(f'<a href="{esc(b["file"])}" target="_blank" rel="noopener">{esc(b["file"].removesuffix(".jpg").replace("_"," · "))} ↗</a>' for b in boards)
    if (out/'发色来源与推荐依据.md').exists():
        board_links += '<a href="发色来源与推荐依据.md" target="_blank" rel="noopener">查看发色来源与推荐依据 ↗</a>'
    data = [{k:v for k,v in i.items() if k in ('id','name','preview','image_path','care_note','display_summary','comparison_preview','comparison_label')} for i in looks]
    template = (Path(__file__).resolve().parent.parent/'assets/lookbook-template.html').read_text()
    recommended = [i for i in looks if i.get('recommended')][:3]
    recommendation_copy = '可以先比较 '+ '、'.join(f'<a href="#look-{esc(i["id"])}" data-jump="{esc(i["id"])}">{esc(i["id"])} {esc(i["name"])}</a>' for i in recommended)+'。' if recommended else '先选几款喜欢的方向，再一起细调。'
    replacements = {'__CARDS__': ''.join(cards), '__BOARDS__': board_links, '__COUNT__': str(len(looks)), '__RECOMMENDATIONS__': recommendation_copy, '__DATA__': json.dumps(data, ensure_ascii=False).replace('<', '\\u003c')}
    labels = copy.get('filter_labels', {'natural':'自然与分缝','short':'清爽短发','texture':'卷度与留长'})
    replacements['__FILTERS__'] = ''.join(f'<button class="filter" data-filter="{esc(key)}" aria-pressed="false">{esc(label)}</button>' for key,label in labels.items() if key in {i['category'] for i in looks})
    for key, default in {'heading':'换个发型，先看见效果。','intro':f'{len(looks)} 款方案，统一人物与构图。先比较喜欢的轮廓，再确定刘海、卷度和打理方式。','section_heading':'按编号，找到喜欢的方向','compare_label':'对照基准'}.items():
        replacements['__'+key.upper()+'__'] = esc(copy.get(key,default))
    for key, value in replacements.items():
        template = template.replace(key, value)
    (out/'发型方案图册.html').write_text(template)
    (out/'look-plan.json').write_text(json.dumps(looks, ensure_ascii=False, indent=2))
    provenance = {'source_batch': str(source), 'new_image_generation_calls': 0, 'original_outputs_unchanged': all(digest(out/h['file']) == h['source_sha256'] for h in hashes), 'originals': hashes, 'presentation_only': True, 'display_crop_normalized': crop, 'baseline_display_crop_pixels': baseline_box, 'preview_size': [800,1000], 'boards': boards, 'customer_identity_acceptance': 'pending', 'stylist_feasibility': 'unreviewed'}
    (out/'evidence/presentation-provenance.json').write_text(json.dumps(provenance, ensure_ascii=False, indent=2))
    print(json.dumps({'gallery': str(out/'发型方案图册.html'), 'looks': len(looks), 'boards': boards, 'original_outputs_unchanged': provenance['original_outputs_unchanged']}, ensure_ascii=False))


if __name__ == '__main__':
    main()
