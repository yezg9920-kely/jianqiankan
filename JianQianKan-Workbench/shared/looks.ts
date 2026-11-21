import type { Preferences, StyleSpec } from './types';

export const LOOK_VERSION = '4.0' as const;
export const preferenceDefaults = {
  currentLength: '不确定', presentation: '不限风格', fringe: '都可以',
  tieUp: false, growOut: false, styling: false, goal: '多看一些',
} as const;

interface Cut {
  id: string; name: string; family: string; fringe: string; parting: string;
  sides: string; crown: string; open?: boolean; styling?: boolean; long?: boolean;
}
// These are design ingredients. The planner filters and pairs them using explicit
// preferences; it never claims to have diagnosed a face from a photograph.
const shortCuts: Cut[] = [
  {id:'side',name:'柔和侧分',family:'自然日常',fringe:'侧向展开，保留一部分额头覆盖',parting:'自然偏侧分线',sides:'柔和贴合耳上，保留连接',crown:'低幅度侧向流动'},
  {id:'airy',name:'轻碎刘海',family:'自然日常',fringe:'眉上轻薄碎刘海，不画成齐整厚块',parting:'弱化分线，向前自然散落',sides:'轻盈连接，保留真实厚度',crown:'低层次自然轮廓'},
  {id:'open',name:'自然露额',family:'轮廓变化',fringe:'向侧后整理，额头露出',parting:'顺原生走向',sides:'收窄耳周堆积，保持真实头宽',crown:'克制的顶部抬起',open:true,styling:true},
  {id:'curtain',name:'柔和中分',family:'自然日常',fringe:'两边形成柔和开口，保留脸周碎发',parting:'中分',sides:'自然垂落衔接耳周',crown:'自然弧线，无夸张发量'},
  {id:'diagonal',name:'斜向层次',family:'层次细节',fringe:'斜向渐进，眉上轻盈断续',parting:'明显侧向流线',sides:'层次与顶部连续连接',crown:'斜向层叠，避免过高'},
  {id:'full',name:'整齐厚刘海',family:'轮廓变化',fringe:'相对整齐的眉上覆盖，厚度不超过真实发量',parting:'无明显分线',sides:'圆润连接，避免膨大头型',crown:'较低的圆润剪裁轮廓'},
  {id:'crop',name:'短碎前额',family:'轮廓变化',fringe:'较短且参差的前额边缘',parting:'向前',sides:'短而连续，不默认剃光',crown:'紧凑轮廓，有可见细碎层次'},
  {id:'slick',name:'低蓬后梳',family:'轮廓变化',fringe:'往后整理，露出额头',parting:'柔和后梳流向',sides:'耳后顺贴，不改耳位',crown:'低幅后梳体积',open:true,styling:true},
  {id:'ear',name:'清爽耳周',family:'自然日常',fringe:'保留轻薄额前覆盖',parting:'顺原有分线',sides:'耳周轮廓清楚，鬓角自然',crown:'顶部保留长度，侧边轻收'},
  {id:'spike',name:'短刺纹理',family:'轮廓变化',fringe:'短发束自然向上',parting:'无明显分缝',sides:'连贯短轮廓，非剃光渐变',crown:'可见短发束，不能增加虚假发量',open:true,styling:true},
  {id:'round',name:'柔圆短层次',family:'层次细节',fringe:'弧形轻刘海，发尾不齐切',parting:'自然散落',sides:'柔和弧形，轻包耳上',crown:'有层次的圆润发型外轮廓'},
  {id:'asym',name:'不对称长刘海',family:'层次细节',fringe:'一侧较长斜向刘海，另一侧轻收',parting:'侧分',sides:'两侧长度形成克制差异',crown:'低重心侧向层次'},
  {id:'pixie',name:'精灵短层次',family:'轮廓变化',fringe:'短碎片状刘海',parting:'顺原生方向',sides:'耳周较短，层次轻巧连接',crown:'短层次，真实头型不动'},
  {id:'soft',name:'自然软碎',family:'层次细节',fringe:'保留眉上自然碎边',parting:'弱分缝',sides:'顶部到侧边逐渐变轻',crown:'柔软羽状层次，保持原生纹理'},
  {id:'arc',name:'弧线长前区',family:'层次细节',fringe:'前区略长，弧线向两侧连贯展开',parting:'偏侧分线',sides:'两侧较短，长前区连续过渡',crown:'前长后短的低幅弧线'},
];
const longCuts: Cut[] = [
  {id:'u',name:'柔和 U 形发尾',family:'保留长度',fringe:'保留当前刘海',parting:'保留原有分线',sides:'脸周保持长度，发尾呈柔和 U 形',crown:'低层次，保持顶部真实体积',long:true},
  {id:'straight',name:'齐感厚发尾',family:'保留长度',fringe:'保留当前刘海',parting:'自然分线',sides:'一长轮廓，发尾厚度真实',crown:'整体低层次，不增加发量',long:true},
  {id:'face',name:'脸周渐进层次',family:'脸周变化',fringe:'与两侧连接的较长刘海',parting:'自然偏侧',sides:'脸周层次渐进，保留后区长度',crown:'轻层次，顶部不夸张',long:true},
  {id:'longcurtain',name:'长帘式刘海',family:'脸周变化',fringe:'长帘式刘海向两侧自然打开',parting:'中分',sides:'长刘海与外轮廓连续',crown:'克制柔和弧线',long:true},
  {id:'longairy',name:'轻透刘海长发',family:'脸周变化',fringe:'轻薄额前覆盖，不强制改变原生卷曲',parting:'弱化前区分线',sides:'后区保持长度，脸周自然连接',crown:'自然发根',long:true},
  {id:'low',name:'低层次长发',family:'保留长度',fringe:'保留原有刘海长度',parting:'保留原有分线',sides:'层次集中在发尾，后区保持长度',crown:'顶部不打薄',long:true},
  {id:'high',name:'高层次长碎',family:'层次变化',fringe:'轻盈长刘海',parting:'自然中分',sides:'高低层次明显，底部长度保留',crown:'高位层次，不能凭空增量',long:true,styling:true},
  {id:'v',name:'轻 V 形发尾',family:'层次变化',fringe:'保留现有前区覆盖',parting:'顺原分线',sides:'向背部中线渐长，克制 V 形发尾',crown:'中低层次',long:true},
  {id:'sideLong',name:'偏分垂顺长发',family:'保留长度',fringe:'长刘海侧向覆盖',parting:'明显偏分',sides:'连续长轮廓，耳前顺落',crown:'低幅侧向弧线',long:true},
  {id:'fullLong',name:'齐刘海长线条',family:'脸周变化',fringe:'较完整的额前刘海覆盖',parting:'前区无分缝',sides:'保留长轮廓，与刘海形成对照',crown:'自然体积',long:true},
  {id:'openLong',name:'露额长层次',family:'层次变化',fringe:'长前区向侧后，露出额头',parting:'柔和偏分',sides:'向后连接，保留外轮廓长度',crown:'低蓬流线',long:true,open:true},
  {id:'feather',name:'轻羽脸周',family:'层次变化',fringe:'片状脸周长刘海',parting:'顺原生走向',sides:'前区轻羽状连接，底线保留',crown:'分散轻层次',long:true,styling:true},
  {id:'longNatural',name:'原生纹理轮廓',family:'保留长度',fringe:'依照原生纹理保留刘海',parting:'保留原生分线',sides:'按现有纹理收整外缘，保留长度',crown:'保持真实发根，不自动拉直',long:true},
  {id:'behindEar',name:'挂耳长层次',family:'脸周变化',fringe:'长前区自然挂耳，不修动耳位',parting:'柔和侧分',sides:'耳后顺接，保留整体长度',crown:'克制弧度',long:true,open:true},
];

export function completeLookPlan(input: Preferences, limit = 12): { styles: StyleSpec[]; notes: string[] } {
  const p = { ...preferenceDefaults, ...input }, notes: string[] = [];
  if (p.currentLength === '不确定' && p.length === '保持长度') {
    return { styles: [], notes: ['请先选择当前发长，或指定希望的长度，才能安排有区别的完整搭配。'] };
  }
  if (p.bleach && !p.dye) return { styles: [], notes: ['漂浅需要同时接受染发；也可以关闭漂浅。'] };
  if (p.tieUp && p.length === '短发') return { styles: [], notes: ['需要扎发与短发目标冲突，请调整其中一项。'] };
  const targetLong = p.tieUp || p.length === '长发' || p.length === '中长发' || (p.length === '保持长度' && p.currentLength !== '短发');
  const grow = targetLong && (p.currentLength === '短发' || (p.currentLength === '齐肩' && p.length === '长发'));
  if (grow && !p.growOut) return { styles: [], notes: ['目标需要留长，请选择接受留长，或调整目标长度。'] };
  let cuts = [...(targetLong ? longCuts : shortCuts)];
  if (p.fringe === '保留刘海' || /不露额|不露额头|不要露额/.test(p.keep + p.avoid)) cuts = cuts.filter(x => !x.open);
  if (p.fringe === '露额') cuts = cuts.filter(x => x.open);
  if (!p.styling) cuts = cuts.filter(x => !x.styling);
  if (p.tieUp) {
    cuts = cuts.filter(x => !['longairy', 'fullLong', 'high', 'feather'].includes(x.id));
    notes.push('所有方案优先保留可扎长度；最短脸周和实际能否扎起仍需本人确认。');
  }
  if (p.goal === '自然整理') cuts.sort((a,b) => Number(a.family !== (targetLong ? '保留长度' : '自然日常')) - Number(b.family !== (targetLong ? '保留长度' : '自然日常')));
  if (p.goal === '明显变化') cuts.sort((a,b) => Number(b.family.includes('变化')) - Number(a.family.includes('变化')));
  cuts = cuts.slice(0, limit);
  if (cuts.length < 12) notes.push(`按当前长度、刘海与打理限制，安排 ${cuts.length} 套；不重复换色凑数。`);
  notes.push('以下是偏好规则规划，未经照片分析。生成前须由操作者核对照片、自由填写的限制与每套规格。');
  if (p.keep || p.avoid) notes.push('自由填写的保留与避雷项已进入每份提示词，仍需操作者逐项核对。');
  const colors = [
    ['柔和茶棕','#665044'],['深巧克力棕','#43332c'],['保留原发色','#35322e'],['冷调深棕','#51463f'],
    ['栗茶棕','#6a4936'],['保留原发色','#35322e'],['烟灰银','#a8a29b'],['浅米棕','#b79b78'],
    ['深巧克力棕','#43332c'],['柔和茶棕','#665044'],['玫瑰米色','#bb9690'],['栗茶棕','#6a4936'],
  ];
  const styles = cuts.map((cut,i): StyleSpec => {
    let color = colors[i % colors.length];
    const light = p.dye && p.bleach && [3,7,10].includes(i);
    if (!p.dye) color = ['保留原发色','#35322e'];
    else if (light) color = i === 3 ? ['奶油米金','#c6ac83'] : i === 7 ? ['烟灰银','#a8a29b'] : ['玫瑰米色','#bb9690'];
    else if ([6,7,10].includes(i)) color = ['深巧克力棕','#43332c'];
    const dye = color[0] !== '保留原发色';
    const reason = `${cut.family}方向，重点看${cut.parting}与${cut.sides}；${dye ? `${color[0]}呈现${light ? '更明亮的发束对比' : '克制的深浅变化'}` : '保留原发色，先看轮廓变化'}。`;
    return {
      id:`P${String(i+1).padStart(2,'0')}`, name:cut.name, direction:cut.family,
      length: targetLong ? (p.length === '保持长度' ? '整体长度保留，以原照落点为准' : `${p.length}方向；具体落点现场确认`) : (p.length === '保持长度' ? '在原照短发长度内整理，不接长' : '短发方向，具体落点现场确认'),
      fringe:p.tieUp ? `脸周保留能参与扎发的长度；${cut.fringe}` : cut.fringe,
      parting:cut.parting,sides:cut.sides,crown:cut.crown,
      texture:`保留原生纹理（本人填写：${p.hairTexture}），不自动拉直${cut.styling ? '；可使用本人接受的吹整与造型' : ''}`,
      ears: targetLong ? '耳前与后区保持真实连接，不移动耳朵' : '顺真实耳位连接，不默认剃光',
      nape: targetLong ? '保留发尾长度，未见背面不推测真实后脑' : '后颈自然收整，未见区域由理发师现场确认',
      maintenance:cut.styling ? '需要吹整或造型品；方法与耗时待确认' : '优先按原生纹理整理；效果与修剪频率现场确认',
      services:['剪发；可实现程度待现场确认',...(dye ? [light ? '染发＋可能漂浅；需核对底色和烫染史' : '染发；以不漂为约束，目标不易达到时调整颜色'] : []),...(grow ? ['需留长，非当天纯剪可达'] : [])],
      unknowns:['真实发质、发旋及烫染史','未拍摄部位的真实结构','自由填写限制需操作者核对','最终颜色、可行性及报价待现场确认'],source:'rules',
      look:{version:LOOK_VERSION,family:light ? '浅色探索' : cut.family,cutId:cut.id,color:color[0],colorHex:color[1],reason,requiresDye:dye,requiresBleach:light,requiresPerm:false,requiresGrowOut:grow,requiresStyling:!!cut.styling},
    };
  });
  return { styles, notes };
}
