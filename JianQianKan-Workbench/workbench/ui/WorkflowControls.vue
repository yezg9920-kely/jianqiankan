<script setup lang="ts">
import Icon from './Icon.vue';
import { workflowKinds,workflowMoods } from '../model';
import type { Preferences, WorkflowKind, WorkflowMood } from '../model';
type Settings={kind:WorkflowKind;mood:WorkflowMood;previewCount:number};
const props=defineProps<{settings:Settings;preferences:Preferences;hasBaseline?:boolean;anchored?:boolean}>();
const emit=defineEmits<{'update:settings':[Settings];'update:preferences':[Preferences]}>();
const glyphs:Record<WorkflowKind,string>={cut:'scissors',look:'spark',color:'photo',texture:'outline'};
function choice<K extends keyof Settings>(key:K,value:Settings[K]){
  emit('update:settings',{...props.settings,[key]:value});
}
function pref<K extends keyof Preferences>(key:K,value:Preferences[K]){
  emit('update:preferences',{...props.preferences,[key]:value});
}
const value=(e:Event)=>(e.target as HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement).value;
const checked=(e:Event)=>(e.target as HTMLInputElement).checked;
</script>
<template>
  <div class="workflow-controls">
    <p class="input-label">做哪种方案</p>
    <div class="kind-grid" role="group" aria-label="方案类型">
      <button v-for="(item,id) in workflowKinds" :key="id" class="kind-card" :aria-pressed="settings.kind===id" type="button" @click="choice('kind',id)">
        <Icon :name="glyphs[id]" :size="19"/><span><strong>{{ item.name }}</strong><small>{{ item.detail }}</small></span>
      </button>
    </div>
    <p v-if="settings.kind==='color'||settings.kind==='texture'" class="muted compare-note">{{anchored?'比较时保留当前所看的剪裁。':'比较时保留原照中的剪裁。'}}</p>
    <p class="input-label">偏好的风格</p>
    <div class="mood-group" role="group" aria-label="偏好风格">
      <button v-for="(text,id) in workflowMoods" :key="id" type="button" class="mood" :aria-pressed="settings.mood===id" @click="choice('mood',id)">{{ text }}</button>
    </div>
    <div class="form-grid">
      <label class="input-label">发型目录
        <select :value="preferences.direction" @change="pref('direction',value($event) as Preferences['direction'])">
          <option value="中性发型">不限，按照片和条件推荐</option><option>男生发型</option><option>女生发型</option>
        </select>
      </label>
      <label class="input-label">想先看几款
        <select :value="settings.previewCount" @change="choice('previewCount',Number(value($event)))">
          <option :value="1">1 款 · 先试效果</option><option :value="2">2 款 · 并排比较</option><option v-if="hasBaseline" :value="3">3 款 · 多看一个方向</option>
        </select>
      </label>
    </div>
    <details class="conditions workflow-advanced">
      <summary>多一点控制 <small>发长、刘海、打理方式</small></summary>
      <div class="form-grid">
        <label class="input-label">现在发长<select :value="preferences.currentLength" @change="pref('currentLength',value($event) as Preferences['currentLength'])">
          <option>不确定</option><option>短发</option><option>齐肩</option><option>长发</option>
        </select></label>
        <label class="input-label">想保留多长<select :value="preferences.targetLength" @change="pref('targetLength',value($event) as Preferences['targetLength'])">
          <option>保持长度</option><option value="中长发">可剪到齐肩附近</option><option value="短发">想试短发</option>
        </select></label>
        <label class="input-label">刘海<select :value="preferences.fringe" @change="pref('fringe',value($event) as Preferences['fringe'])">
          <option>都可以</option><option>保留刘海</option><option>露额</option>
        </select></label>
        <label class="check advanced-check"><input type="checkbox" :checked="preferences.styling" @change="pref('styling',checked($event))" />可以用吹整做造型</label>
      </div>
      <label class="input-label free-note">补充需求 <small>可选</small><textarea :value="preferences.goal" rows="2" maxlength="700" placeholder="例如：刘海轻一些，头发要能扎起来" @input="pref('goal',value($event))"></textarea></label>
    </details>
  </div>
</template>

