export const hairColorCheckedAt = '2026-11-21';

export interface HairColor {
  id: string;
  name: string;
  family: string;
  tone: string;
  depth: string;
  swatch: string;
  highlight: string;
  contrast: string;
  dye: string;
  fade: string;
  maintenance: string;
  lift: 'usually-no' | 'base-dependent' | 'usually-yes';
  upkeep: 'low' | 'medium' | 'high';
  placement: string;
  sourceIds: string[];
}

export const hairColorSources = [
  { id:'wella-nov', title:'Wella Professionals · 11 月发色专刊', date:'2026-10-31', kind:'专业品牌趋势专题', url:'https://us.wella.professionalstore.com/en-US/blog/hair-color/hair-color-trends-november-2026' },
  { id:'wella-espresso', title:'Wella Professionals · 深棕发色横向比较', date:'2026-11-17', kind:'专业品牌色调说明', url:'https://www.wella.com/professional/en-US/blog/hair-color/espresso-brown-hair-color-ideas' },
  { id:'pinterest-fall', title:'Pinterest · 2026 Beauty Trend Report', date:'2026-10-06', kind:'Pinterest 公开搜索趋势', url:'https://newsroom.pinterest.com/news/beauty-trend-report-2026/' },
  { id:'redken-fall', title:'Redken · 季节发色趋势', date:'2026-10-06', kind:'专业品牌趋势专题', url:'https://www.redken.com/blog/seasonal-hair-color-trends.html' },
  { id:'mc-fall', title:'Marie Claire 台湾 · 2026 秋冬髮色推薦', date:'2026-10-15', kind:'编辑精选 · 部分图片来自小红书', url:'https://www.marieclaire.com.tw/beauty/hair/96549' },
  { id:'xhs-ash', title:'小红书 · 榛果灰棕参考', date:'2026-11-14 查阅', kind:'小红书存档样本 · 含产品推荐', url:'https://www.xiaohongshu.com/explore/6ad745670000000030006d7b' },
  { id:'xhs-chestnut', title:'小红书 · 栗棕素人自测', date:'2026-11-14 查阅', kind:'小红书存档样本 · 褪色参考', url:'https://www.xiaohongshu.com/explore/6ad5dd040000000027015651' },
  { id:'xhs-brown', title:'小红书 · 秋季发色极限九选一', date:'2026-11-14 查阅', kind:'小红书存档样本 · 对照图鉴', url:'https://www.xiaohongshu.com/explore/6adf01d4000000000d03972f' },
  { id:'xhs-cocoa', title:'小红书 · 入秋新发色是巧克力棕', date:'2026-11-14 查阅', kind:'小红书存档样本 · 含产品推荐', url:'https://www.xiaohongshu.com/explore/6ae549100000000025010e1c' },
  { id:'xhs-berry', title:'小红书 · 都说紫发很有韵味…', date:'2026-11-14 查阅', kind:'小红书存档样本 · 含产品推荐', url:'https://www.xiaohongshu.com/explore/6aed6d6f000000000803faae' },
];

export const hairColors: HairColor[] = [
  {
    id:'espresso', name:'浓缩咖啡棕', family:'日常深色', tone:'中性', depth:'极深',
    swatch:'#322621', highlight:'#60483d', contrast:'室内近深黑，在亮处能看见低调咖啡反光。',
    dye:'同深度换色一般可从不漂方向评估，旧的深色染料需现场确认。',
    fade:'可能逐渐露出原底色或棕暖反光。', maintenance:'发根反差通常较小，先观察日常光线里的变化。',
    lift:'usually-no', upkeep:'low', sourceIds:['wella-nov','wella-espresso'],
    placement:'全头极深中性咖啡棕，带少量棕色发丝反光；保留深暗部，仍与自然纯黑有轻微区别。',
  },
  {
    id:'chocolate', name:'巧克力棕', family:'日常深色', tone:'中性偏暖', depth:'深',
    swatch:'#644637', highlight:'#936b50', contrast:'比咖啡棕更暖、更容易在头发边缘看出可可光泽。',
    dye:'深棕可从低提浅方向评估，黑染底色或已有色带需先做束测。',
    fade:'可能渐露棕暖或偏红的底色。', maintenance:'日常可先比较褪色后的暖棕是否也喜欢。',
    lift:'usually-no', upkeep:'low', sourceIds:['redken-fall','mc-fall','xhs-cocoa'],
    placement:'全头深可可棕，亮部是克制的奶巧暖棕；比浓缩咖啡棕亮一点，避开明显红铜或金黄。',
  },
  {
    id:'cool-tea', name:'冷茶棕', family:'柔雾棕', tone:'冷', depth:'深',
    swatch:'#52473d', highlight:'#85776a', contrast:'保留棕色主体，把红橙反光压低，深度接近日常色。',
    dye:'是否提浅取决于原底；旧红棕、黑染和偏橙底色尤其要先核对。',
    fade:'冷感减弱后，底色可能重新显暖。', maintenance:'介意红橙反光时，先问理发师维持冷棕的方式。',
    lift:'base-dependent', upkeep:'medium', sourceIds:['xhs-brown'],
    placement:'全头低明度冷茶棕，细发丝带低饱和灰褐反光；保留棕色感，不做纯黑、银灰或全图冷滤镜。',
  },
  {
    id:'mushroom', name:'烟熏蘑菇棕', family:'柔雾棕', tone:'冷中性', depth:'中',
    swatch:'#766959', highlight:'#a29988', contrast:'灰褐比冷茶棕更明显，亮部有雾米灰感。',
    dye:'灰褐效果取决于底色是否足够浅、均匀；深底可能要提浅。',
    fade:'灰调可能先变淡，露出米棕或暖底。', maintenance:'偏灰效果对光线和褪色敏感，可留深根降低反差。',
    lift:'base-dependent', upkeep:'medium', sourceIds:['wella-nov','redken-fall','xhs-ash'],
    placement:'全头中等明度烟熏蘑菇灰棕，米灰褐亮丝和深褐暗丝共存；不做银白、蓝灰或无层次灰块。',
  },
  {
    id:'olive', name:'雾橄榄棕', family:'柔雾棕', tone:'冷', depth:'中',
    swatch:'#615b42', highlight:'#928663', contrast:'棕底带低饱和橄榄反光，户外比室内明显。',
    dye:'底色偏红或偏橙时需现场评估；要明显的雾感可能需要提浅。',
    fade:'可能弱化为偏暖棕或显出黄调。', maintenance:'先比较能否接受绿感减轻后的棕色。',
    lift:'base-dependent', upkeep:'medium', sourceIds:['mc-fall'],
    placement:'全头柔雾橄榄棕，棕是主体，亮部微带低饱和橄榄色；避免鲜绿、灰绿大色块和全图偏绿。',
  },
  {
    id:'chestnut', name:'暖栗棕', family:'暖调棕', tone:'暖', depth:'中',
    swatch:'#895938', highlight:'#bc875a', contrast:'比巧克力更亮，带栗壳般的红棕和微铜反光。',
    dye:'先按底色评估棕度与红铜比例；追求较亮效果时可能需提浅。',
    fade:'可能渐变为更浅的暖棕或橙棕。', maintenance:'暖感保留与根部明暗差按实际底色核对。',
    lift:'base-dependent', upkeep:'medium', sourceIds:['mc-fall','xhs-chestnut'],
    placement:'全头中等明度栗棕，棕色占主导，红铜在受光发丝可见；色感暖于巧克力但不接近纯铜橙。',
  },
  {
    id:'cherry-cola', name:'樱桃可乐棕', family:'个性色', tone:'冷红', depth:'深',
    swatch:'#542a35', highlight:'#954454', contrast:'深褐底有明显樱桃红反光，和铜棕的橙暖方向不同。',
    dye:'需要先核对黑染史和底色；红感强弱由理发师根据发束测试调整。',
    fade:'红调可能渐淡为暗红棕或暖棕。', maintenance:'想维持樱桃红线条时，要接受之后补色的可能。',
    lift:'base-dependent', upkeep:'medium', sourceIds:['pinterest-fall','redken-fall','mc-fall'],
    placement:'全头深樱桃可乐棕，深褐发丝有莓红和暗酒红亮部；不做纯亮红、紫罗兰或漂浅。',
  },
  {
    id:'blackcurrant', name:'黑加仑紫棕', family:'个性色', tone:'冷紫', depth:'深',
    swatch:'#4b324c', highlight:'#875778', contrast:'深棕里有葡萄紫反光，比樱桃可乐更紫、更克制。',
    dye:'想明显看到莓紫时要先看底色，深底可能只看见低调反光。',
    fade:'紫感减弱后可能往红棕或褐棕过渡。', maintenance:'对紫感要求强时，先核对补色和褪色路线。',
    lift:'base-dependent', upkeep:'medium', sourceIds:['xhs-berry'],
    placement:'全头深黑加仑紫棕，亮发丝出现低饱和葡萄紫、莓紫；区别于暗酒红，不染成霓虹紫或粉。',
  },
  {
    id:'maple-copper', name:'枫糖铜棕', family:'暖调棕', tone:'暖铜', depth:'中亮',
    swatch:'#9d512e', highlight:'#d68d57', contrast:'比栗棕更靠红铜，暖光下呈琥珀橙棕。',
    dye:'要实现清晰的琥珀铜色，深冷或有染黑史的底色常要评估提浅。',
    fade:'铜感减弱后可能转为更浅的橙棕或金棕。', maintenance:'明显铜色更依赖补色，提前比较褪色后是否也可接受。',
    lift:'base-dependent', upkeep:'high', sourceIds:['wella-nov'],
    placement:'全头中亮枫糖铜棕，琥珀红铜在亮部清楚可见，发丝暗部保留棕色；不做荧光橙或纯红。',
  },
  {
    id:'milk-tea', name:'奶茶米棕', family:'高明度', tone:'中性偏暖', depth:'中亮',
    swatch:'#9d846d', highlight:'#c5ae90', contrast:'比普通棕色更轻，米褐色里有浅拿铁感。',
    dye:'深底若想做到柔和浅米棕，通常要先判断能否提浅；有黑染史先束测。',
    fade:'低饱和米感减少后，可能显黄或偏暖。', maintenance:'建议比较发根长出后的色差和日后补色意愿。',
    lift:'base-dependent', upkeep:'medium', sourceIds:['xhs-brown'],
    placement:'全头柔和中亮奶茶米棕，浅咖啡米褐亮部和真实深发丝阴影，不做亮黄、橘色或银灰。',
  },
  {
    id:'caramel-gold', name:'焦糖金棕', family:'暖调棕', tone:'暖金', depth:'中亮',
    swatch:'#9a7040', highlight:'#d3a563', contrast:'亮部偏蜂蜜金棕，比奶茶米棕更暖，比枫糖铜棕少红感。',
    dye:'深色底想看清金棕时需要评估提浅程度，黑染或色带要先束测。',
    fade:'金暖感可能变得更明显，原底较深时发根对比会增加。', maintenance:'重点比较是否接受褪色后的暖黄感，再考虑补色。',
    lift:'base-dependent', upkeep:'medium', sourceIds:['mc-fall','redken-fall'],
    placement:'全头中亮焦糖金棕，保留浓棕暗部，明显的蜂蜜金棕亮丝。暖而偏金，和枫糖红铜的橙红、奶茶米棕的灰米明确不同，不做铜红或亮黄。',
  },
  {
    id:'vanilla-beige', name:'香草米金', family:'高明度', tone:'中性偏暖', depth:'很亮',
    swatch:'#c1a47e', highlight:'#e3cfab', contrast:'奶油米金，和任何深棕都有较明显的明暗差。',
    dye:'深色原底通常要先明显提浅，可能需要漂发；漂次与可行性须束测。',
    fade:'米调可能褪成更明显的浅黄。', maintenance:'发根对比和发丝状态都要评估；是高维护方向。',
    lift:'usually-yes', upkeep:'high', sourceIds:['wella-nov'],
    placement:'全头高明度奶油米金，维持自然发丝暗部和光泽；比奶茶明确更亮，不做铂白、亮黄或漂白皮肤。',
  },
];
