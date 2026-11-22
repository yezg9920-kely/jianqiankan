<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { hairColorCheckedAt, hairColors, hairColorSources } from '../color-catalog';
import type { ColorBaseOptions, Consultation, Photo, Plan, Round } from '../model';
import Icon from './Icon.vue';
import { dates } from './useWorkspace';

type HairColor = (typeof hairColors)[number];
const props=defineProps<{
  consultation:Consultation;
  rounds:Round[];
  roundId:string;
  busy:boolean;
  workflowBusy:boolean;
}>();
const emit=defineEmits<{
  'change-round':[id:string];
  save:[colors:string[],options:ColorBaseOptions];
  generate:[ids:string[]];
  select:[id:string];
  revise:[id:string];
  inspect:[id:string];
  view:[image:Photo,title:string,label:string,previous?:Photo,previousLabel?:string];
}>();

const baseChoice=ref('tidy');
const anchorClean=ref(false);
const family=ref('');
const lift=ref('');
const upkeep=ref('');
const trendsOnly=ref(false);
const selectedColors=ref<string[]>([]);
const selectedPreviews=ref<string[]>([]);
const cloud=ref(false);
const comparison=ref<HTMLElement|null>(null);
const savingGroup=ref(false);
const displayColors=computed(()=>hairColors.filter(c=>(!family.value||c.family===family.value)
  &&(!lift.value||c.lift===lift.value)&&(!upkeep.value||c.upkeep===upkeep.value)
  &&(!trendsOnly.value||hasRecentTrend(c))));
const palette=new Map<string,HairColor>(hairColors.map(c=>[c.id,c]));
const sources=new Map(hairColorSources.map(s=>[s.id,s]));
const families=[...new Set(hairColors.map(c=>c.family))];
const anchorOptions=computed(()=>props.consultation.plans.filter(p=>p.image&&!p.colorId));
const anchor=computed(()=>anchorOptions.value.find(plan=>plan.id===baseChoice.value));
const anchorPreview=computed(()=>anchor.value&&anchorClean.value?anchor.value.image:baseChoice.value==='original'?props.consultation.baseline:undefined);
const anchorPhoto=computed(()=>anchor.value?.image??props.consultation.photo);
const roundPlans=computed(()=>props.consultation.plans.filter(p=>p.round===props.roundId&&p.colorId));
const compareCards=computed(()=>[...roundPlans.value]
  .sort((a,b)=>Number(Boolean(b.image))-Number(Boolean(a.image)))
  .map(item=>({item,color:item.revision?undefined:palette.get(item.colorId??'')})));
const baseRef=computed(()=>roundPlans.value[0]?.colorBase);
const basePlan=computed(()=>props.consultation.plans.find(p=>p.id===baseRef.value?.planId));
const basePhoto=computed(()=>baseRef.value?.cleanPhoto);
const baseName=computed(()=>baseRef.value?.planId?basePlan.value?.name??'已保存发型':baseRef.value?.tidy?'原发型微整理':'原发型');
const baseLabel='统一浅底';
const canGenerate=computed(()=>Boolean(baseRef.value?.photo));
const generationLimit=computed(()=>basePhoto.value?3:2);
const pending=computed(()=>roundPlans.value.filter(plan=>!plan.image));
const readyToGenerate=computed(()=>selectedPreviews.value.filter(id=>pending.value.some(plan=>plan.id===id)));
const disabled=computed(()=>props.busy||props.workflowBusy);
const labels={low:'低',medium:'中',high:'高'} as const;
const chipStyle=(c:HairColor)=>({'--swatch-deep':c.swatch,'--swatch-light':c.highlight});
const imageLabel=(plan:Plan)=>plan.imageSource==='imported'?'导入 · 待核对':'AI 发色试戴';

function citations(color:HairColor){
  return color.sourceIds.flatMap(id=>{
    const source=sources.get(id);
    return source?[source]:[];
  });
}
function hasRecentTrend(color:HairColor){
  return citations(color).some(source=>/趋势|编辑精选/.test(source.kind));
}
function chooseStarter(){
  const available=displayColors.value;
  const preferred=['espresso','cool-tea','cherry-cola','milk-tea'];
  const ordered=[...preferred.flatMap(id=>available.filter(color=>color.id===id)),
    ...available.filter(color=>!preferred.includes(color.id))];
  const byFamily=new Map<string,HairColor>();
  for(const color of ordered) if(!byFamily.has(color.family)) byFamily.set(color.family,color);
  const varied=[...byFamily.values()];
  selectedColors.value=[...varied,...ordered.filter(color=>!varied.includes(color))].slice(0,4).map(color=>color.id);
}
function chooseDisplayed(){
  selectedColors.value=displayColors.value.map(color=>color.id);
}
function toggleColor(id:string){
  selectedColors.value=selectedColors.value.includes(id)
    ?selectedColors.value.filter(value=>value!==id)
    :[...selectedColors.value,id];
}
function togglePreview(id:string){
  cloud.value=false;
  const selected=readyToGenerate.value;
  if(selected.includes(id))selectedPreviews.value=selected.filter(value=>value!==id);
  else if(selected.length<generationLimit.value)selectedPreviews.value=[...selected,id];
}
function saveColors(){
  if(disabled.value||!anchorPhoto.value||selectedColors.value.length<2)return;
  savingGroup.value=true;
  emit('save',selectedColors.value.slice(),{
    anchorPlanId:anchor.value?.id,anchorClean:Boolean(anchor.value&&anchorClean.value),preserveOriginal:baseChoice.value==='original',
  });
}
function generateColors(){
  if(disabled.value||!cloud.value||!readyToGenerate.value.length||!canGenerate.value)return;
  emit('generate',readyToGenerate.value.slice());
  cloud.value=false;
}
function viewPlan(plan:Plan){
  const base=basePhoto.value;
  if(plan.image)emit('view',plan.image,plan.name,imageLabel(plan),base,baseLabel);
}
watch([baseChoice,()=>anchor.value?.image?.id],()=>{anchorClean.value=false;});
watch(()=>props.consultation.id,()=>{
  baseChoice.value='tidy';anchorClean.value=false;selectedColors.value=[];savingGroup.value=false;
});
watch(()=>props.roundId,async()=>{
  selectedPreviews.value=[];
  cloud.value=false;
  if(!savingGroup.value)return;
  savingGroup.value=false;selectedColors.value=[];
  await nextTick();
  comparison.value?.scrollIntoView({block:'start'});
});
watch(()=>props.busy,value=>{if(!value)savingGroup.value=false;});
</script>

<template>
  <div class="color-page">
    <section v-if="roundPlans.length" ref="comparison" class="boxed color-comparison" aria-labelledby="color-compare-title">
      <header class="section-head">
        <div>
          <h2 id="color-compare-title">同款发色对照</h2>
          <p class="muted">{{ roundPlans.length }} 款 · {{ roundPlans.length-pending.length }} 张试戴图</p>
        </div>
        <label class="round-control" v-if="rounds.length">
          <span class="visually-hidden">发色对照轮次</span>
          <select :value="roundId" @change="emit('change-round',($event.target as HTMLSelectElement).value)">
            <option v-for="r in [...rounds].reverse()" :key="r.id" :value="r.id">{{ r.label }} · {{ dates(r.at) || r.count+' 款' }}</option>
          </select>
          <Icon name="down" :size="15" />
        </label>
      </header>

      <div class="color-compare-grid">
        <figure class="color-compare-card color-compare-base">
          <button v-if="basePhoto" class="color-compare-picture" type="button" :aria-label="'放大'+baseLabel" @click="emit('view',basePhoto,baseName,baseLabel)">
            <img :src="basePhoto.thumb" alt="本轮统一浅底发色基准" />
            <span>{{ baseLabel }}</span>
          </button>
          <div v-else class="color-compare-picture color-preview-empty"><Icon name="photo" :size="27" /><span>待整理底图</span></div>
          <figcaption class="color-compare-copy">
            <span class="eyebrow">本轮底图</span>
            <strong>{{ baseName }}</strong>
            <p>比色沿用同一发型和光线，统一使用纯净浅底。</p>
          </figcaption>
        </figure>

        <article v-for="{item,color} in compareCards" :key="item.id" class="color-compare-card" :class="{'color-saved':consultation.selected===item.id}">
          <button v-if="item.image" class="color-compare-picture" type="button" :aria-label="'放大'+item.name" @click="viewPlan(item)">
            <img :src="item.image.thumb" :alt="item.name+' 试戴图'" loading="lazy" />
            <span>{{ imageLabel(item) }}</span>
          </button>
          <div v-else class="color-compare-picture color-preview-empty">
            <span v-if="color" class="color-chip" :style="chipStyle(color)" aria-hidden="true"></span>
            <Icon v-else name="photo" :size="24" />
            <span>待生成试戴</span>
          </div>
          <div class="color-compare-copy">
            <span class="eyebrow">{{ item.code }}<template v-if="item.revision"> · 第 {{ item.revision }} 版</template></span>
            <strong>{{ item.name }}</strong>
            <template v-if="item.revision">
              <p>{{ item.spec.color || item.description }}</p>
            </template>
            <template v-else-if="color">
              <p>{{ color.tone }} · {{ color.depth }}</p>
              <p>{{ color.contrast }}</p>
              <details class="color-card-sources">
                <summary>染发与维护</summary>
                <p>{{ color.dye }}</p>
                <p>{{ color.fade }}</p>
              </details>
            </template>
          </div>
          <div class="color-compare-actions">
            <label v-if="!item.image" class="check">
              <input type="checkbox" :checked="readyToGenerate.includes(item.id)"
                :disabled="disabled||(!readyToGenerate.includes(item.id)&&readyToGenerate.length>=generationLimit)"
                @change="togglePreview(item.id)" />
              <span>选来试戴</span>
            </label>
            <button class="btn btn-quiet btn-small" type="button" :disabled="disabled" @click="emit('revise',item.id)">改发色</button>
            <button class="btn btn-quiet btn-small" type="button" :disabled="busy||consultation.selected===item.id" @click="emit('select',item.id)">{{ consultation.selected===item.id?'已设备选':'设为备选' }}</button>
            <button v-if="!item.image&&(!baseRef?.tidy||basePhoto)" class="btn btn-quiet btn-small" type="button" :disabled="disabled" @click="emit('inspect',item.id)">制作与导入</button>
          </div>
        </article>
      </div>

      <form v-if="pending.length&&canGenerate" class="color-generate" @submit.prevent="generateColors">
        <div>
          <p class="muted" aria-live="polite">{{ basePhoto?'每批可选 1–3 款，继续沿用统一浅底。':'首次整理统一浅底，本批可选 1–2 款。' }}</p>
          <label v-if="readyToGenerate.length" class="check">
            <input v-model="cloud" type="checkbox" :disabled="disabled" />
            <span>同意使用该案例的授权照片交给 Codex 制作这批试戴图。</span>
          </label>
        </div>
        <button class="btn btn-primary" type="submit" :disabled="disabled||!readyToGenerate.length||!cloud">
          <Icon name="spark" :size="17" />{{ readyToGenerate.length?'生成 '+readyToGenerate.length+' 款试戴':'选择试戴颜色' }}
        </button>
      </form>
    </section>

    <section class="boxed color-library" aria-labelledby="color-library-title">
      <header class="section-head color-library-head">
        <div>
          <h2 id="color-library-title">发色分析</h2>
          <p class="muted">选两种以上发色，比较色调、明度、是否需提浅和褪色方向。</p>
        </div>
        <div class="palette-actions">
          <button type="button" class="btn btn-outline btn-small" :disabled="disabled||displayColors.length<2" :title="displayColors.length<2?'可先放宽筛选，至少留出两种发色':undefined" @click="chooseStarter">
            <Icon name="spark" :size="16" />推荐一组
          </button>
          <button type="button" class="btn btn-outline btn-small" :disabled="disabled||displayColors.length<2" @click="chooseDisplayed">
            选中全部 {{ displayColors.length }} 款
          </button>
        </div>
      </header>

      <div class="color-anchor">
        <div class="color-anchor-photo">
          <img v-if="anchorPreview" :src="anchorPreview.thumb" alt="" />
          <Icon v-else name="photo" :size="17" />
        </div>
        <label class="input-label">这组沿用哪张底图
          <select v-model="baseChoice" :disabled="disabled||!consultation.photo">
            <option value="tidy">{{ consultation.photo?'先微整理原发型（推荐）':'请先保存顾客正面照' }}</option>
            <option value="original">沿用原发型</option>
            <option v-for="option in anchorOptions" :key="option.id" :value="option.id">{{ option.code }} · {{ option.name }}</option>
          </select>
        </label>
        <div class="anchor-explanation">
          <p v-if="baseChoice==='tidy'">保留发长和发际线，轻理分线、刘海和乱翘发束，再用同一张浅底图比较所有颜色。</p>
          <p v-else>沿用所选发型和光线，所有试戴统一使用纯净浅底。</p>
          <label v-if="anchor" class="check">
            <input v-model="anchorClean" type="checkbox" :disabled="disabled" />
            <span>已确认这款发型图是干净浅底，直接用作对照</span>
          </label>
        </div>
      </div>

      <div class="color-filters" aria-label="筛选发色">
        <label class="input-label">色系
          <select v-model="family"><option value="">全部色系</option><option v-for="item in families" :key="item">{{ item }}</option></select>
        </label>
        <label class="input-label">提浅条件
          <select v-model="lift">
            <option value="">不限</option><option value="usually-no">通常无需漂浅</option>
            <option value="base-dependent">取决于底色</option><option value="usually-yes">通常需提浅</option>
          </select>
        </label>
        <label class="input-label">维护
          <select v-model="upkeep">
            <option value="">不限</option><option value="low">低</option><option value="medium">中</option><option value="high">高</option>
          </select>
        </label>
        <label class="check"><input v-model="trendsOnly" type="checkbox" /><span>仅看近期趋势专题</span></label>
      </div>

      <div v-if="displayColors.length" class="color-palette">
        <article v-for="color in displayColors" :key="color.id" class="color-catalog-card"
          :class="{picked:selectedColors.includes(color.id)}">
          <button class="color-card-toggle" type="button" :aria-pressed="selectedColors.includes(color.id)"
            :aria-label="color.name" :disabled="disabled" @click="toggleColor(color.id)">
            <span class="color-chip" :style="chipStyle(color)" aria-hidden="true">
              <span class="color-chip-select"><Icon :name="selectedColors.includes(color.id)?'check':'plus'" :size="16" /></span>
            </span>
            <span class="color-card-heading">
              <strong>{{ color.name }}</strong>
              <span>{{ color.tone }} · {{ color.depth }}</span>
            </span>
          </button>
          <dl class="color-card-facts">
            <div><dt>视觉变化</dt><dd>{{ color.contrast }}</dd></div>
            <div><dt>染发条件</dt><dd>{{ color.dye }}</dd></div>
            <div><dt>褪色</dt><dd>{{ color.fade }}</dd></div>
            <div><dt>维护</dt><dd>{{ labels[color.upkeep] }} · {{ color.maintenance }}</dd></div>
          </dl>
          <details v-if="citations(color).length" class="color-card-sources">
            <summary>{{ hasRecentTrend(color)?'近期专题与参考':'公开参考' }}</summary>
            <ul>
              <li v-for="source in citations(color)" :key="source.id">
                <a :href="source.url" target="_blank" rel="noopener noreferrer">{{ source.title }}<Icon name="external" :size="12" /></a>
                <small>{{ source.kind }} · {{ source.date }}</small>
              </li>
            </ul>
          </details>
        </article>
      </div>
      <p v-else class="color-palette-empty muted">暂无匹配的色号，试试放宽一个筛选条件。</p>
      <p v-if="displayColors.length===1" class="color-palette-empty muted">当前仅匹配一款。可以放宽筛选，再加一款对照。</p>

      <footer class="color-library-footer">
        <div>
          <div class="color-chosen" v-if="selectedColors.length">
            <button v-for="id in selectedColors" :key="id" class="color-chosen-token" type="button"
              :aria-label="'移除'+palette.get(id)?.name" :disabled="disabled" @click="toggleColor(id)">
              <span :style="{background:palette.get(id)?.swatch}" aria-hidden="true"></span>
              {{ palette.get(id)?.name }}<Icon name="close" :size="12" />
            </button>
          </div>
          <p class="muted" role="status">{{ selectedColors.length?'已选 '+selectedColors.length+' 款':'至少选两款发色' }} · 保存对照组只在本机记录</p>
        </div>
        <button class="btn btn-primary" type="button" :disabled="disabled||selectedColors.length<2||!anchorPhoto" @click="saveColors">
          <Icon name="gallery" :size="17" />保存对照组
        </button>
      </footer>
      <p class="color-source-note muted">色卡为屏幕示意。公开参考核对于 {{ hairColorCheckedAt }}，每条出处注明时间和类型。</p>
    </section>
  </div>
</template>
<style scoped>
.palette-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:6px}
.anchor-explanation .check{margin-top:5px;font-size:12px}
@media(max-width:800px){.anchor-explanation{grid-column:1/-1}}
@media(max-width:575px){.color-library-head{flex-wrap:wrap}.palette-actions{justify-content:flex-start}}
</style>
