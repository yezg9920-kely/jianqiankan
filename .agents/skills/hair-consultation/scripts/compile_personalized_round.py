"""Validate photo observations and compile a personalized design round.

The Codex multimodal conversation supplies the observations. This script does
NOT detect landmarks, classify a face from pixels, call a model, or generate images.
"""
from pathlib import Path
import argparse
import hashlib
import itertools
import json
import sys

GEOMETRY = ('fringe', 'parting', 'sides', 'crown', 'perimeter')
CONFIDENCE = {'high', 'medium', 'low', 'unknown'}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def validate_profile(profile, case, case_root):
    if profile.get('analysis_method') != 'codex_multimodal_visual_observation':
        raise ValueError('Record the actual visual observation method.')
    if profile.get('status') != 'observed':
        raise ValueError('A blank observation template is not a completed analysis.')
    assets = {a['id']: a for a in case['assets']}
    checked = set()
    for ref in profile.get('input_assets', []):
        asset = assets.get(ref['asset_id'])
        if not asset or asset.get('kind') != 'original' or asset.get('is_real_photo') is False:
            raise ValueError('Contour evidence must use real original photos.')
        path = (case_root / asset['path']).resolve()
        if not path.is_relative_to(case_root.resolve()) or not path.is_file():
            raise ValueError('Original asset must exist inside this private case.')
        if not ref.get('visually_viewed') or ref['sha256'] != asset['sha256'] or sha(path) != ref['sha256']:
            raise ValueError('Original hash or actual-view record does not match.')
        checked.add(ref['asset_id'])
    if not any(assets[i].get('view') == 'front' for i in checked):
        raise ValueError('A real front photo is required for a front-view design.')
    observations = profile.get('observations', [])
    if len(observations) < 3 or len({o['id'] for o in observations}) != len(observations):
        raise ValueError('Require at least three distinct observations.')
    for o in observations:
        if o.get('confidence') not in CONFIDENCE or not o.get('value') or not o.get('description'):
            raise ValueError('Every observation needs a value, explanation and qualitative confidence.')
        if not o.get('evidence_assets') or not set(o['evidence_assets']) <= checked:
            raise ValueError('Observation evidence must link to viewed originals.')
        if o['value'] == 'unknown' and o['confidence'] != 'unknown':
            raise ValueError('Unknown detail cannot have asserted confidence.')
    if profile.get('label_status') != 'tentative_photo_impression':
        raise ValueError('Photo-based face labels must remain tentative.')
    if not profile.get('limitations') or not profile.get('design_goals'):
        raise ValueError('Record photo limitations and intended design goals.')
    return {o['id']: o for o in observations}


def validate_plan(profile, plan, observations):
    options = plan.get('options', [])
    expected = plan.get('expected_count', 12)
    if len(options) != expected or len({o['id'] for o in options}) != expected:
        raise ValueError('Option count and unique IDs must match the bounded plan.')
    required_families = min(4, expected)
    if len({o['family'] for o in options}) < required_families:
        raise ValueError('Use distinct silhouette families; recoloring is not a new haircut.')
    elongated = any(o.get('feature') == 'vertical_impression' and o['value'] == 'elongated' and o['confidence'] in {'medium','high'} for o in observations.values())
    hidden_hairline = any(o.get('feature') == 'hairline' and o['value'] == 'unknown' for o in observations.values())
    sharp = profile.get('style_intent') == 'clean_structured'
    for option in options:
        if not all(option.get('geometry', {}).get(key) for key in GEOMETRY):
            raise ValueError('Specify fringe, parting, sides, crown and perimeter independently.')
        if option['geometry']['crown'] not in {'low','moderate','high'}:
            raise ValueError('Crown height must use low/moderate/high, not an ambiguous synonym.')
        refs = option.get('addresses_observations', [])
        if not refs or not set(refs) <= set(observations) or all(observations[r]['value'] == 'unknown' for r in refs):
            raise ValueError('Every recommendation must address visible customer evidence.')
        if not option.get('personal_reason') or not option.get('hair_spec') or not option.get('service_conditions'):
            raise ValueError('Require a personal reason, implementable hair description and conditions.')
        if elongated and option['geometry']['crown'] == 'high' and not (option.get('exploration') and option.get('intentional_tradeoff')):
            raise ValueError('High crown conflicts with this balancing goal; explain an intentional exploration.')
        if sharp and option['geometry']['perimeter'] == 'rounded_helmet' and not option.get('intentional_tradeoff'):
            raise ValueError('A rounded helmet conflicts with the customer request for a sharper outline.')
        if hidden_hairline and option.get('forehead_exposure') == 'full' and 'hairline' not in option.get('unknowns_to_check', []):
            raise ValueError('An open-forehead design must flag the unobserved hairline.')
    for first, second in itertools.combinations(options, 2):
        distance = sum(first['geometry'][k] != second['geometry'][k] for k in GEOMETRY)
        if distance == 0 or (first['family'] == second['family'] and distance < 2):
            raise ValueError(f"Insufficient structural difference: {first['id']} / {second['id']}; color and names do not count.")
    return {'option_count': len(options), 'silhouette_families': len({o['family'] for o in options}), 'personal_evidence_links': True, 'structure_diversity_checked': True, 'scope': 'design-plan checks only; generated visual difference and attractiveness remain untested'}


def compile_round(case_root, profile, plan, output):
    case = json.loads((case_root/'case.json').read_text(encoding='utf-8'))
    observations = validate_profile(profile, case, case_root)
    validation = validate_plan(profile, plan, observations)
    assets = {a['id']: a for a in case['assets']}
    baseline = assets.get(plan.get('baseline_asset_id'))
    if not baseline or baseline.get('kind') != 'generated':
        raise ValueError('Link the actual existing baseline portrait.')
    baseline_path = (case_root/baseline['path']).resolve()
    if not baseline_path.is_relative_to(case_root.resolve()) or not baseline_path.is_file() or sha(baseline_path) != baseline['sha256']:
        raise ValueError('Baseline source hash does not match.')
    front = next(assets[r['asset_id']] for r in profile['input_assets'] if assets[r['asset_id']]['view']=='front')
    output.mkdir(parents=True, exist_ok=True, mode=0o700)
    (output/'prompts').mkdir(exist_ok=True, mode=0o700)
    compiled = []
    report = ['# 本人轮廓观察与个性化发型设计', '', '本轮审美方向：'+str(profile.get('customer_style_words') or profile.get('style_intent') or '按设计目标探索'), '', '整体轮廓印象：'+str(profile.get('face_shape_impression') or '保留开放判断')+'。', '', '照片观察由Codex读图完成；以下是设计依据和待生成方案，不是精确脸型测量或已验证效果。', '', '## 照片观察与待确认项', '']
    confidence_labels = {'high':'较清楚','medium':'初步判断','low':'不确定','unknown':'待确认'}
    report += [f"- {o['description']}（{confidence_labels[o['confidence']]}）" for o in profile['observations']]
    report += ['', '## 这次希望达到的效果', '', *['- '+s for s in profile['design_goals']], '', '## 方案与个人依据', '', '| 编号 | 方向 | 为什么为本人这样设计 | 条件 |', '|---|---|---|---|']
    for option in plan['options']:
        evidence = '\n'.join('- '+observations[r]['description'] for r in option['addresses_observations'])
        style_words = profile.get('customer_style_words') or profile.get('style_intent') or 'No additional preference supplied; follow the recorded design goals without inferring personality.'
        style_label = 'Customer stated style request' if str(profile.get('style_intent_source','')).startswith('explicit') else 'Working design intention; no extra customer preference is confirmed'
        prompt = f'''Use case: identity-preserve. ONE personalized hairstyle portrait, not a collage.
INPUT 1 is the existing clean-background baseline portrait: edit target for the same person's face, glasses, expression, lighting, clothing and framing. INPUT 2 is the real original front photo, authoritative identity cross-check. Side photos were used for observation only; do not average faces or invent a new view.
{style_label}: {style_words}. Do not infer personality from appearance.
Customer-specific visible evidence informing this hair design:
{evidence}
Design goals: {'; '.join(profile['design_goals'])}
Target {option['id']}: {option['name']}
Hair geometry: {json.dumps(option['geometry'],ensure_ascii=False)}
Specific design: {option['hair_spec']}
Color: {option.get('color','preserve the source hair color')}
Personal design reasoning: {option['personal_reason']}
Conditions: {option['service_conditions']}
Unknown details to check: {', '.join(option.get('unknowns_to_check',[])) or 'actual hair behavior and stylist feasibility'}
Only modify scalp hair and necessary occlusion boundaries. Preserve actual face width, jaw/chin, eyes, eyebrows, nose, lips, skin tone and texture, age, facial hair, glasses, ears and neck. Do not reshape the face to satisfy the proposed balance. No extra beautification, skin whitening, makeup or different expression. Keep the baseline clothing, background, soft light, angle and head size. No invented hair density, lowered hairline or hidden-head measurements. The tentative face-shape description is not an instruction to change the face.
Show the full hair silhouette. Preserve realistic individual strands and implement the selected silhouette clearly, following the customer's stated preference. Add only “{option['id']} {option['name']}” and “AI效果预览” at the lower margin. Output ONE portrait.'''
        (output/'prompts'/f"{option['id']}.txt").write_text(prompt, encoding='utf-8')
        compiled.append({**option,'prompt_path':f"prompts/{option['id']}.txt",'reference_paths':[str(baseline_path),str(case_root/front['path'])],'reference_sha256':[baseline['sha256'],front['sha256']],'status':'planned_not_generated','prompt':prompt})
        report.append(f"| {option['id']} | {option['name']} | {option['personal_reason']} | {option['service_conditions']} |")
    report += ['', '## 本次仍不确定的部分', '', *['- '+s for s in profile['limitations']], '', '这些方向用于下一轮视觉验证；本人是否喜欢、人物是否还原、理发师能否实现，分别保留待确认。']
    (output/'轮廓观察与个性化设计说明.md').write_text('\n'.join(report)+'\n', encoding='utf-8')
    (output/'compiled-plan.json').write_text(json.dumps({'profile':profile,'validation':validation,'options':compiled,'actual_new_image_generation_calls':0,'stage':'personalized_design_ready'},ensure_ascii=False,indent=2), encoding='utf-8')
    (output/'validation.json').write_text(json.dumps(validation,ensure_ascii=False,indent=2), encoding='utf-8')
    return validation


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('case_root',type=Path);p.add_argument('profile',type=Path);p.add_argument('plan',type=Path);p.add_argument('output',type=Path)
    a=p.parse_args()
    result=compile_round(a.case_root.resolve(),json.loads(a.profile.read_text(encoding='utf-8')),json.loads(a.plan.read_text(encoding='utf-8')),a.output.resolve())
    print(json.dumps(result,ensure_ascii=False))


if __name__=='__main__':
    sys.stdout.reconfigure(encoding='utf-8', errors='backslashreplace')
    sys.stderr.reconfigure(encoding='utf-8', errors='backslashreplace')
    main()
