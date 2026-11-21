import { createRequire } from 'node:module';
import type { Preferences as RulePreferences } from '../shared/types';
import { defaults, fields } from './model';
import type { Analysis, Field, Plan, Preferences } from './model';

const { completeLookPlan } = createRequire(import.meta.url)('../shared/looks.ts') as typeof import('../shared/looks');

const existingLength: { id: string; name: string; category: string; fringe: string; crown: string; sides: string; parting: string; open?: boolean }[] = [
  { id: 'soft-side', name: '柔和偏分', category: '分线变化', fringe: '前区沿着原生走向往一侧，保留少量额前发束', crown: '低幅度偏侧蓬松', sides: '耳周轻收', parting: '自然偏侧' },
  { id: 'airy-front', name: '轻透前区', category: '刘海变化', fringe: '保留额前覆盖，把现有刘海整理成轻透发束', crown: '顶部保持原有厚度', sides: '自然连到鬓角', parting: '弱化明显分线' },
  { id: 'curtain', name: '柔和帘式分线', category: '脸周变化', fringe: '沿现有长度把前区分到两侧，保留脸周短发', crown: '自然弧度', sides: '耳前发束逐渐向下', parting: '自然中分' },
  { id: 'offset', name: '斜向发束', category: '层次变化', fringe: '一侧前区较完整地斜过眉上，另一侧只留薄束', crown: '低重心斜向层次', sides: '轻重错开，保留连续性', parting: '侧分' },
  { id: 'ear-tuck', name: '单侧挂耳', category: '脸周变化', fringe: '保留原生前区覆盖，用一侧发束露出耳廓', crown: '保留现有顶区轮廓', sides: '有足够长度的一侧向耳后收整', parting: '沿原分线' },
  { id: 'smooth-edge', name: '干净外缘', category: '轮廓变化', fringe: '前区走向沿用当前发型', crown: '顶部自然落下', sides: '顺着原有外缘整理，耳周留柔和连接', parting: '沿原分线' },
  { id: 'soft-frame', name: '柔和脸周弧线', category: '脸周变化', fringe: '把现有前区顺成向脸外的柔和弧线', crown: '克制自然弧线', sides: '耳前保留弧度，顺发尾落点整理', parting: '轻微偏侧' },
  { id: 'wide-side', name: '低重心侧蓬', category: '轮廓变化', fringe: '前区保留覆盖，发尾斜向同一侧', crown: '顶部少量蓬松', sides: '保留侧边自然重量', parting: '柔和偏分' },
  { id: 'sweep-back', name: '清爽露额侧梳', category: '分线变化', fringe: '现有前区向侧后梳，展示额头', crown: '控制顶部高度', sides: '顺着耳侧轮廓回收', parting: '偏分', open: true },
  { id: 'soft-back', name: '自然后梳', category: '轮廓变化', fringe: '顺原生方向向后露额', crown: '后向的低蓬轮廓', sides: '自然贴耳，保留原长', parting: '弱分缝', open: true },
  { id: 'diagonal-open', name: '斜向露额', category: '刘海变化', fringe: '额前向一侧上扬，保留另一侧的脸周连接', crown: '克制斜向起伏', sides: '两侧自然错落', parting: '明显侧分', open: true },
];

type Candidate = Omit<Plan, 'id' | 'round' | 'code' | 'at'>;
const extraConditions = ['当前发长与造型条件需要现场确认。', '实际纹理、发旋与隐藏发际线待核实。'];

export function cleanPreferences(input: unknown, current: Preferences = defaults): Preferences {
  const p = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const length = ['不确定', '短发', '齐肩', '长发'];
  const fringe = ['都可以', '保留刘海', '露额'];
  const lengths = ['保持长度', '中长发', '短发'];
  const direction = ['中性发型', '男生发型', '女生发型'];
  return {
    currentLength: length.includes(String(p.currentLength)) ? p.currentLength as Preferences['currentLength'] : current.currentLength,
    targetLength: lengths.includes(String(p.targetLength)) ? p.targetLength as Preferences['targetLength'] : current.targetLength,
    fringe: fringe.includes(String(p.fringe)) ? p.fringe as Preferences['fringe'] : current.fringe,
    direction: direction.includes(String(p.direction)) ? p.direction as Preferences['direction'] : current.direction,
    styling: typeof p.styling === 'boolean' ? p.styling : current.styling,
    dye: typeof p.dye === 'boolean' ? p.dye : current.dye,
    goal: typeof p.goal === 'string' ? p.goal.trim().slice(0, 700) : current.goal,
  };
}

function visualReason(plan: Candidate, analysis?: Analysis): string {
  if (analysis?.status !== 'ready') return plan.description;
  if (analysis.vertical === 'longer' && /低|克制|保留/.test(plan.spec.crown ?? '')) {
    return `${plan.description} 正面照片里纵向感较明显，这款控制顶部高度，保留侧边的视觉重量。`;
  }
  if (analysis.jaw === 'tapered' && /脸周|分线/.test(plan.category)) {
    return `${plan.description} 照片里下颌向下收，可以重点比较耳前发束与下颌的衔接。`;
  }
  return plan.description;
}

function configuredCandidates(p: Preferences): Candidate[] {
  const noColor = /不染|不要染|不漂|保留原发色/.test(p.goal);
  const keepFringe = /不露额|不要露额|保留刘海/.test(p.goal);
  const fringe = keepFringe ? '保留刘海' : p.fringe;
  const requiresTie = /要能扎|必须能扎|保留可扎|需要扎发/.test(p.goal);
  if (p.targetLength === '短发' && (requiresTie || /不剪短|不要剪短|只修发尾|保留长度/.test(p.goal))) return [];
  if (p.currentLength === '不确定' && p.targetLength === '中长发') return [];
  if (p.currentLength === '不确定' && p.targetLength === '保持长度') {
    return existingLength.filter(c => fringe === '都可以' || Boolean(c.open) === (fringe === '露额'))
      .map((c, i) => ({
        cutId: `existing-${c.id}`, source: 'rules', name: c.name, category: c.category,
        description: `用${c.parting}和${c.sides}比较轮廓变化，沿用现有长度。`,
        fullSpec: '',
        spec: {
          length: '保留当前整体长度', fringe: c.fringe, parting: c.parting, sides: c.sides, crown: c.crown,
          texture: '保留可见原生纹理',
          color: p.dye && !noColor && i % 2 === 0 ? ['柔和茶棕', '深巧克力棕', '冷调深棕'][Math.floor(i / 2) % 3] : '保留原发色',
          care: '可先用梳理与简单吹整观察效果，实施方式取决于现有发长。',
        },
        conditions: [...extraConditions, ...(p.dye && !noColor && i % 2 === 0 ? ['发色仅作视觉方向，底色和染发条件待核实。'] : [])],
      }));
  }
  const prefs: RulePreferences = {
    length: /不剪短|不要剪短|只修发尾/.test(p.goal) ? '保持长度' : p.targetLength, currentLength: p.currentLength, perm: false, bleach: false,
    dye: p.dye && !noColor, fringe, budget: '', minutes: '', keep: '', avoid: p.goal,
    hairTexture: '待确认', density: '待确认', history: '待确认', styling: p.styling && !/不打理|不要造型品/.test(p.goal),
    tieUp: requiresTie,
    goal: /日常|自然/.test(p.goal) ? '自然整理' : /变化大|明显变化/.test(p.goal) ? '明显变化' : '多看一些',
    presentation: p.direction === '男生发型' ? '男生方向' : p.direction === '女生发型' ? '女生方向' : '中性方向',
  };
  return completeLookPlan(prefs, Number.POSITIVE_INFINITY).styles.map(item => ({
    cutId: (item.look?.cutId ?? item.id) + '-' + p.targetLength, source: 'rules', name: item.name, category: item.direction,
    description: item.look?.reason ?? '',
    fullSpec: `耳周：${item.ears}\n后颈：${item.nape}`,
    spec: {
      length: item.length, fringe: item.fringe, parting: item.parting, sides: item.sides, crown: item.crown,
      texture: item.texture, color: item.look?.color ?? '保留原发色', care: item.maintenance,
    },
    conditions: [...item.services, '发旋、纹理与烫染史由本人补充。'],
  }));
}

function fitScore(candidate: Candidate, prefs: Preferences, observation?: Analysis): number {
  let score = 0;
  const spec = Object.values(candidate.spec).join(' ');
  if (observation?.vertical === 'longer' && /控制顶部|低重心|顶部不|低幅度/.test(spec)) score += 2;
  if (observation?.jaw === 'tapered' && /脸周|耳前/.test(spec)) score += 2;
  if (/利落|硬朗|清爽/.test(prefs.goal)) {
    if (/斜向|短碎|收窄|收整|耳周轮廓清楚/.test(candidate.name+' '+spec)) score += 5;
    if (/圆润|包耳|厚刘海|柔和中分/.test(candidate.name+' '+(candidate.spec.sides??''))) score -= 4;
  }
  if (/柔和层次|轻盈|留长|减轻脸周/.test(prefs.goal) && /脸周|长刘海|轻层次/.test(spec)) score += 4;
  if (/法式松弛/.test(prefs.goal)&&/轻薄|轻透|原生纹理|弧线/.test(candidate.name+' '+(candidate.spec.fringe??''))) score += 4;
  if (/复古线条/.test(prefs.goal)&&/显著偏分|侧向|侧后|弧线/.test(candidate.name+' '+(candidate.spec.fringe??'')+' '+(candidate.spec.parting??''))) score += 4;
  if (/个性变化/.test(prefs.goal)&&/斜向|不对称|外缘|层次变化/.test(candidate.name+' '+spec)) score += 3;
  return score;
}

export function availablePlans(prefs: Preferences, existing: Plan[], analysis?: Analysis): Candidate[] {
  const excluded = new Set(existing.filter(p => p.cutId).map(p => p.cutId));
  const names = new Set(existing.map(p => p.name));
  const choices = configuredCandidates(prefs).filter(p => !excluded.has(p.cutId) && !names.has(p.name))
    .filter(p => !/不要圆|减少圆|少一点圆|减轻圆/.test(prefs.goal) || !/柔圆|厚刘海|包耳上/.test(p.name + (p.spec.sides || '')))
    .sort((a,b) => fitScore(b, prefs, analysis) - fitScore(a, prefs, analysis));
  const groups = new Map<string, Candidate[]>();
  for (const plan of choices) {
    const group = groups.get(plan.category) ?? [];
    group.push({ ...plan, description: visualReason(plan, analysis) });
    groups.set(plan.category, group);
  }
  const result: Candidate[] = [];
  for (let i = 0; result.length < choices.length; i++) {
    for (const group of groups.values()) if (group[i]) result.push(group[i]);
  }
  return result;
}

export function compilePrompt(plan: Plan, prefs: Preferences, identity: { path: string; sha256: string }, parent?: { path: string; sha256: string }, baseline?: { path: string; sha256: string }) {
  const specs = Object.entries(plan.spec).map(([field, value]) => `- ${fields[field as Field]}：${value}`).join('\n');
  const revised = plan.change
    ? `这次修改仅针对${fields[plan.change.field]}，目标是「${plan.change.after}」。它覆盖历史方案中这一个细节。\n`
    : '';
  const references = `图 1 为真实原照和本人身份依据，${identity.path}。SHA-256 ${identity.sha256}。\n` +
    (parent ? `图 2 为同案例上版效果图，${parent.path}。SHA-256 ${parent.sha256}。仅参考未修改的发型结构，不作为人脸依据。\n` : baseline ? `图 2 为同案例整理底图，${baseline.path}。SHA-256 ${baseline.sha256}。用于延续干净背景和构图，真实原照仍是身份依据。\n` : '');
  return `用 $hair-consultation 执行本方案的单张发型效果预览。确认本案例的人像使用与本次云端处理用途后再调用内置图像工具。\n\n` +
    `# ${plan.name}\n\n${references}\n只编辑头发及必要遮挡。保持真实本人五官、肤色、年龄感、面部几何、服装、相机角度和光线。有同案例整理底图就沿用其构图和干净背景。缺整理底图时，保持原取景并用中性浅色背景、自然调整光线；不要修饰五官。完整保留头顶和头发边缘。\n` +
    `\n${revised}${plan.fullSpec ? `既有方案记录\n${plan.fullSpec}\n\n` : ''}${specs}\n\n` +
    `目录方向为${prefs.direction}。顾客补充需求为「${prefs.goal || '按当前条件'}」。\n` +
    `输出一张无文字的单人正面 AI 效果预览。保存工具实际回执与图片，返回此工作台导入到此版本。\n`;
}
