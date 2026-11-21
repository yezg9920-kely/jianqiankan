<script setup lang="ts">
import Icon from './Icon.vue';
import WorkflowControls from './WorkflowControls.vue';
import { dates, sourceLabels, useWorkspace, viewName } from './useWorkspace';
import { activeWorkflow,fields,workflowKinds,workflowMoods } from '../model';
import type { Field } from '../model';
const {
  cases,current,tab,roundId,busy,toast,error,initialized,modal,dialog,dialogError,caseTitle,frontFile,
  filePreview,authorized,cloudAuthorized,suite,draftPrefs,changeField,changeValue,promptTask,preview,compare,rounds,plans,compactPlans,picturePlans,plan,parent,
  versions,report,task,workflow,workflowBusy,originals,chooseCase,chooseRound,choosePlan,refresh,setFile,setSide,clearModal,close,show,view,create,
  analyze,updateFront,recommend,generateMore,generateSingle,stop,revise,select,makeTask,attach,copy,start,
}=useWorkspace();
const tabs=[
  {id:'plans',name:'造型方案',icon:'gallery'},
  {id:'analysis',name:'照片分析',icon:'analysis'},
  {id:'history',name:'历史记录',icon:'clock'},
] as const;
const fileTypes='.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp';
const modalTitle={new:'新建发型案例',more:'再推荐一组',revise:'修改这款造型',handoff:'交给 Codex 制作',single:'生成这款试戴',import:'导入试戴图',front:'补拍一张正面照',preview:'查看原尺寸'};
const runLabels={queued:'已排队',checking:'分析照片',planning:'设计方案',making:'制作试戴',ready:'已生成',partial:'部分完成',failed:'本轮未出图',retake:'需要补照',stopped:'已停止',interrupted:'制作已断开'} as const;
const slotLabels={queued:'待制作',making:'制作中',attached:'已完成',failed:'未完成',stopped:'已停止'} as const;
const activityIcons={analysis:'analysis',round:'spark',revision:'edit',selection:'pin',image:'photo'};
</script>

<template>
<div class="shell">
  <aside class="sidebar" aria-label="案例列表">
    <div class="brand">
      <div class="brand-mark"><Icon name="scissors" :size="20" /></div>
      <div><span class="brand-name">剪前看看</span><span class="brand-sub">发型工作台</span></div>
    </div>
    <button class="btn btn-side" type="button" @click="show('new')" :disabled="!!busy"><Icon name="plus" />新建案例</button>
    <div class="sidebar-label"><span>我的案例</span><span>{{ String(cases.length).padStart(2,'0') }}</span></div>
    <div class="case-list">
      <button v-for="entry in cases" :key="entry.id" type="button" class="case-card"
        :class="{ active:entry.id===current?.id }" :aria-current="entry.id===current?.id?'page':undefined"
        :disabled="!!busy" @click="chooseCase(entry.id)">
        <img v-if="entry.photo" :src="entry.photo.thumb" alt="" />
        <div v-else class="case-avatar"><Icon name="photo" /></div>
        <span class="case-meta"><strong>{{ entry.title }}</strong><small>{{ dates(entry.date) }}<span> · </span>{{ entry.count }} 款</small></span>
      </button>
      <p v-if="!cases.length && initialized" class="side-empty">照片与试戴记录会保存在这里。</p>
    </div>
    <div class="sidebar-footer">
      <span class="local-dot"></span><span>本机保存</span>
    </div>
  </aside>

  <main class="canvas">
    <div class="topbar"><div><span class="top-path">工作台</span><Icon name="chevron" :size="13" /><span>{{ current?.title || '发型咨询' }}</span></div>
      <button v-if="current" type="button" class="btn btn-quiet refresh" @click="refresh" :disabled="!!busy"><Icon name="reload" :size="16" />刷新</button>
    </div>
    <div v-if="error" class="notice error" role="alert">{{ error }}</div>
    <div v-if="busy" class="notice pending" role="status"><span class="loading"></span>{{ busy }}…</div>

    <div v-if="current" class="content">
      <header class="case-header">
        <div class="case-header-main">
          <span class="eyebrow"><span class="short-line"></span>发型咨询档案</span>
          <h1>{{ current.title }}</h1>
          <p>{{ dates(current.date) }} 建立<span> / </span>{{ current.originals.length }} 张原照<span> / </span>{{ current.rounds.length }} 组方案</p>
        </div>
        <div class="case-header-actions">
          <a v-if="report" :href="report.url" class="btn btn-outline" target="_blank" rel="noopener"><Icon name="report" :size="17" />打开历史报告<Icon name="external" :size="14" /></a>
          <button class="btn btn-primary" type="button" @click="show('more')" :disabled="!!busy||workflowBusy"><Icon name="spark" :size="18" />再生成一组</button>
        </div>
      </header>
      <nav class="tabs" aria-label="案例视图">
        <button v-for="item in tabs" :key="item.id" type="button" class="tab"
          :aria-pressed="tab===item.id" @click="tab=item.id"><Icon :name="item.icon" :size="17" />{{ item.name }}</button>
      </nav>

      <section v-if="workflow" class="generation-panel" :class="'run-'+workflow.stage" aria-label="本轮生成进度">
        <div class="generation-top">
          <div class="generation-title">
            <span class="generation-icon"><Icon :name="activeWorkflow(workflow.stage)?'spark':'report'" :size="19"/></span>
            <div><p class="eyebrow">案例工作流</p><h2>{{ workflowKinds[workflow.kind].name }} · {{ workflowMoods[workflow.mood] }}</h2></div>
          </div>
          <div class="generation-actions">
            <span class="status" :class="{wait:workflow.stage!=='ready'}" role="status">{{ runLabels[workflow.stage] }}</span>
            <button v-if="activeWorkflow(workflow.stage)" class="btn btn-quiet btn-small" type="button" @click="stop" :disabled="!!busy">停止本轮</button>
            <a v-else-if="workflow.round" class="btn btn-outline btn-small" :href="workflow.reportUrl" target="_blank" rel="noopener"><Icon name="report" :size="16"/>查看本轮报告<Icon name="external" :size="13"/></a>
          </div>
        </div>
        <ol v-if="activeWorkflow(workflow.stage)" class="pipeline-steps" aria-label="生成步骤">
          <li :class="{done:workflow.stage==='making'||workflow.stage==='planning',now:workflow.stage==='checking'}">01 分析照片</li>
          <li :class="{done:workflow.stage==='making',now:workflow.stage==='planning'}">02 设计方案</li>
          <li :class="{now:workflow.stage==='making'}">03 制作试戴</li>
          <li>04 查看报告</li>
        </ol>
        <p v-if="workflow.message" class="run-message">{{ workflow.message }}</p>
        <ul v-if="workflow.slots.length" class="workflow-slots">
          <li v-for="slot in workflow.slots" :key="slot.id" :class="'slot-'+slot.status" :title="slot.message">
            <button v-if="slot.picture" type="button" class="slot-picture" :aria-label="'放大'+slot.name" @click="view(slot.picture,slot.name,slot.role==='baseline'?'AI 整理基准照':'AI 效果预览')"><img :src="slot.picture.thumb" alt=""></button>
            <span v-else class="slot-icon"><Icon :name="slot.role==='baseline'?'photo':'outline'" :size="16"/></span>
            <span><strong>{{ slot.name }}</strong><small>{{ slotLabels[slot.status] }}<span v-if="slot.message"> · {{ slot.message }}</span></small></span>
          </li>
        </ul>
        <button v-if="workflow.stage==='retake'" type="button" class="btn btn-outline btn-small" @click="show('front')">补拍正面照</button>
      </section>

      <div v-if="tab==='plans'" class="workspace">
        <section class="looks">
          <header class="section-head">
            <div><p class="eyebrow">按轮次查看</p><h2>造型方案</h2></div>
            <label v-if="rounds.length" class="round-control"><span class="visually-hidden">方案轮次</span>
              <select :value="roundId" @change="chooseRound(($event.target as HTMLSelectElement).value)">
                <option v-for="r in rounds" :key="r.id" :value="r.id">{{ r.label }} · {{ plans.length && r.id===roundId ? plans.length : r.count }} 款</option>
              </select><Icon name="down" :size="15"/>
            </label>
          </header>
          <div v-if="picturePlans.length" class="look-grid">
            <button class="look" v-for="(item,index) in picturePlans" :key="item.id" type="button"
              :class="{chosen:plan?.id===item.id}" :aria-pressed="plan?.id===item.id"
              :aria-label="item.code+' '+item.name+(item.revision?' 第 '+item.revision+' 版':'')"
              @click="choosePlan(item.id,true)">
              <div v-if="item.image" class="look-image">
                <img :src="item.image.thumb" :alt="item.name+' 效果预览'" :loading="index<6?'eager':'lazy'" />
                <span v-if="item.recommended" class="image-mark">本轮首选</span>
                <span v-else-if="current.selected===item.id" class="image-mark">备选</span>
                <span class="image-label">{{ item.imageSource==='imported'?'导入 · 待核对':'AI 预览' }}</span>
              </div>
              <div v-else class="look-image placeholder"><Icon name="outline" :size="34" /><span>待制作效果图</span></div>
              <div class="look-caption">
                <div class="look-id"><span>{{ item.code }}</span><small>{{ item.revision?'第 '+item.revision+' 版':item.category }}</small></div>
                <strong>{{ item.name }}</strong>
                <p>{{ item.source==='revision' ? item.description : item.description || sourceLabels[item.source] }}</p>
              </div>
            </button>
          </div>
          <section v-if="compactPlans.length" class="design-ideas">
            <h3>待试的设计方向</h3><p class="muted">选中你想看的款式，再生成它的试戴图。</p>
            <button v-for="item in compactPlans" type="button" :key="item.id" class="idea" :aria-pressed="plan?.id===item.id" @click="choosePlan(item.id,true)">
              <span class="idea-number">{{ item.code }}</span><span><strong>{{ item.name }}</strong><small>{{ item.description }}</small></span><Icon name="chevron" :size="16"/>
            </button>
          </section>
          <div v-if="!plans.length" class="empty boxed"><Icon name="outline" :size="32" /><h3>还没有这一轮的方案</h3><p>可先做照片分析，再按长度和打理偏好出一组选款建议。</p><button class="btn btn-outline" @click="tab='analysis'">查看照片分析</button></div>
        </section>

        <aside v-if="plan" class="inspector" aria-label="当前方案">
          <div class="inspector-head"><span class="eyebrow">当前方案</span><span class="status"
            :class="{wait:!plan.image || plan.imageSource==='imported'}">{{ plan.image ? (plan.imageSource==='imported'?'图片待核对':'已有试戴图'):'待制作' }}</span></div>
          <div class="inspector-title"><span class="option-id">{{ plan.code }}</span><h3>{{ plan.name }}</h3></div>
          <p class="inspector-meta">{{ sourceLabels[plan.source] }}<span v-if="plan.revision"> / 第 {{ plan.revision }} 版</span><span v-if="plan.at"> / {{ dates(plan.at) }}</span></p>
          <div v-if="plan.image" class="zoom-row">
            <img :src="plan.image.thumb" alt="" />
            <button class="btn btn-outline btn-small" type="button" @click="view(plan.image,plan.name,plan.imageSource==='imported'?'导入效果图 · 待核对':'AI 效果预览')">
              <Icon name="expand" :size="15" />看大图
            </button>
            <button v-if="parent?.image" class="btn btn-quiet btn-small" type="button" @click="view(plan.image,plan.name+' · 新旧对比','本版 AI 效果预览',parent.image)">对比上版</button>
          </div>
          <p v-if="plan.description" class="plan-description">{{ plan.description }}</p>
          <div v-if="plan.change" class="change-note">
            <p class="eyebrow">{{ fields[plan.change.field] }}改动</p>
            <p><span>上版</span>{{ plan.change.before }}</p>
            <p><span>这版</span>{{ plan.change.after }}</p>
          </div>
          <div class="inspector-actions">
            <button class="btn btn-primary" type="button" @click="show('revise')" :disabled="!!busy||workflowBusy"><Icon name="edit" :size="17" />改这款</button>
            <button class="btn btn-outline" type="button" @click="select" :disabled="!!busy||current.selected===plan.id"><Icon name="pin" :size="16" />{{ current.selected===plan.id?'已设备选':'设为备选' }}</button>
          </div>
          <div v-if="versions.length>1" class="version-list">
            <p class="eyebrow">版本回看</p>
            <button v-for="version in versions" :key="version.id" :aria-current="version.id===plan.id?'true':undefined" class="version-item" @click="choosePlan(version.id)">
              <span>{{ version.revision?'第 '+version.revision+' 版':'原方案' }}</span><small>{{ version.image?'有图':'待图' }}</small><Icon name="chevron" :size="14" />
            </button>
          </div>
          <div v-if="Object.keys(plan.spec).length||plan.fullSpec" class="specs">
            <p class="eyebrow">剪裁与造型</p>
            <dl v-if="Object.keys(plan.spec).length">
              <template v-for="(value,key) in plan.spec" :key="key"><dt>{{ fields[key as Field] }}</dt><dd>{{ value }}</dd></template>
            </dl>
            <p v-else class="prewrap">{{ plan.fullSpec }}</p>
          </div>
          <details v-if="plan.conditions.length" class="conditions"><summary>打理与实施条件</summary><p v-for="item in plan.conditions" :key="item">{{ item }}</p></details>
          <div class="handoff">
            <div v-if="task" class="task-state"><span class="local-dot"></span>{{ task.state==='attached'?'任务已回填，待核对':'任务已准备 · 等待制作' }}</div>
            <button v-if="!plan.image" class="btn btn-primary" type="button" @click="show('single')" :disabled="!!busy||workflowBusy"><Icon name="spark" :size="17" />生成这款试戴</button>
            <button class="btn btn-outline" type="button" @click="show('handoff')" :disabled="!!busy||workflowBusy"><Icon name="copy" :size="17" />手动交给 Codex</button>
            <button class="btn btn-quiet" type="button" @click="show('import')" :disabled="!!busy"><Icon name="upload" :size="16" />导入效果图</button>
          </div>
          <button v-if="parent" class="btn btn-quiet up-version" @click="choosePlan(parent.id)"><Icon name="clock" :size="16" />查看上一版</button>
        </aside>
      </div>

      <div v-else-if="tab==='analysis'" class="analysis-grid">
        <section class="boxed">
          <header class="section-head"><div><p class="eyebrow">本案例的输入</p><h2>顾客原照</h2></div>
            <button class="btn btn-outline btn-small" type="button" @click="show('front')" :disabled="!!busy"><Icon name="upload" :size="16" />补拍正面</button>
          </header>
          <div class="photo-grid">
            <button v-for="item in originals" :key="item.id" class="source-photo" type="button" @click="view(item,viewName(item.view)+'原照','顾客原照')">
              <img :src="item.thumb" :alt="viewName(item.view)+'原照'"/><span>{{ viewName(item.view) }}<small v-if="item.id===current.photo?.id"> · 分析用</small></span>
            </button>
          </div>
        </section>
        <section class="boxed analysis-box">
          <header class="section-head">
            <div><p class="eyebrow">{{ current.analysis?.source==='history'?'上次报告的观察':'本机照片初筛' }}</p><h2>脸廓与发型依据</h2></div>
            <button class="btn btn-primary btn-small" :disabled="!!busy" @click="analyze"><Icon name="analysis" :size="17" />运行本机分析</button>
          </header>
          <p v-if="!current.analysis" class="analysis-message">用一张清楚的正面照看看可见脸廓，再结合发长、刘海和打理偏好给建议。</p>
          <p v-else-if="current.analysis.advice" class="analysis-message" :class="{wait:current.analysis.status==='retake'}">{{ current.analysis.advice }}</p>
          <ul v-if="current.analysis?.findings.length" class="findings">
            <li v-for="(finding,i) in current.analysis.findings" :key="i">
              <strong>{{ finding.label }}</strong><div><b v-if="finding.value">{{ finding.value }}</b><p>{{ finding.detail }}</p></div>
            </li>
          </ul>
          <details v-if="current.analysis&&current.analysis.source!=='history'&&current.historyAnalysis" class="conditions">
            <summary>回看原报告的照片观察</summary>
            <p v-for="(finding,i) in current.historyAnalysis.findings" :key="i">{{ finding.label }}：{{ finding.detail }}</p>
          </details>
          <button class="btn btn-outline analysis-next" type="button" @click="show('more')" :disabled="!!busy"><Icon name="spark" :size="17" />按目前条件给推荐</button>
        </section>
      </div>

      <div v-else class="history-grid">
        <section class="boxed">
          <header class="section-head"><div><p class="eyebrow">已保存</p><h2>报告与历史轮次</h2></div></header>
          <a v-for="r in current.reports" :key="r.id" class="history-report" :href="r.url" target="_blank" rel="noopener">
            <Icon name="report" :size="22"/><span><strong>{{ r.title }}</strong><small>打开高清长图</small></span><Icon name="external" :size="17"/>
          </a>
          <a v-for="r in current.workflows.filter(w=>w.round).slice().reverse()" :key="r.id" class="history-report" :href="r.reportUrl" target="_blank" rel="noopener">
            <Icon name="report" :size="22"/><span><strong>{{ workflowKinds[r.kind].name }} · {{ workflowMoods[r.mood] }}</strong><small>{{ dates(r.createdAt) }}　{{ runLabels[r.stage] }}</small></span><Icon name="external" :size="17"/>
          </a>
          <div class="history-rounds">
            <button v-for="r in [...rounds].reverse()" :key="r.id" class="history-round" @click="chooseRound(r.id)">
              <span><strong>{{ r.label }}</strong><small>{{ dates(r.at) }} {{ r.count }} 款</small></span><Icon name="chevron" :size="17"/>
            </button>
            <p v-if="!rounds.length" class="muted">还没有历史方案。</p>
          </div>
        </section>
        <section class="boxed">
          <header class="section-head"><div><p class="eyebrow">可以追溯</p><h2>操作记录</h2></div></header>
          <div v-if="!current.activity.length" class="empty compact"><Icon name="clock" :size="27" /><p>做了分析或修改，新的记录会出现在这里。</p></div>
          <ol v-else class="activity">
            <li v-for="item in [...current.activity].reverse()" :key="item.id">
              <div class="activity-icon"><Icon :name="activityIcons[item.kind]" :size="17"/></div>
              <div><strong>{{ item.title }}</strong><p>{{ item.detail }}</p><small>{{ dates(item.at) }}</small></div>
              <button v-if="item.planId" class="btn btn-quiet btn-small" @click="choosePlan(item.planId)">查看</button>
              <button v-else-if="item.roundId" class="btn btn-quiet btn-small" @click="chooseRound(item.roundId)">查看</button>
            </li>
          </ol>
        </section>
      </div>
    </div>
    <div v-else-if="initialized && !busy" class="empty landing">
      <Icon name="scissors" :size="34" /><h1>从一张正面照开始</h1>
      <p>查看可见轮廓，留下每一轮的发型建议和调整。</p>
      <button v-if="error" class="btn btn-outline" @click="start">重试载入</button>
      <button v-else class="btn btn-primary" @click="show('new')"><Icon name="plus" />新建案例</button>
    </div>
    <div v-if="toast" class="toast" role="status"><Icon name="check" :size="18"/>{{ toast }}</div>
  </main>

  <dialog v-if="modal" ref="dialog" :data-mode="modal" :aria-label="modalTitle[modal]"
    @close="clearModal" @cancel.prevent="!busy&&close()">
    <div class="dialog-header"><div><span class="eyebrow">剪前看看</span><h2>{{ modal==='preview'?preview?.title:modalTitle[modal] }}</h2></div>
      <button class="icon-button" type="button" aria-label="关闭" @click="close" :disabled="!!busy"><Icon name="close" :size="21"/></button>
    </div>
    <div v-if="dialogError" class="notice error" role="alert">{{ dialogError }}</div>

    <form v-if="modal==='new'||modal==='front'||modal==='import'" class="form" @submit.prevent="modal==='new'?create(true):modal==='front'?updateFront():attach()">
      <p v-if="modal==='new'" class="workflow-heading"><span>01</span> 上传顾客原照</p>
      <label v-if="modal==='new'" class="input-label">案例名称 <small>可选</small><input v-model="caseTitle" maxlength="40" placeholder="例如：长发减量" /></label>
      <p v-if="modal==='front'" class="muted">旧原照和历史方案保留。新照片用于之后的本机分析。</p>
      <p v-if="modal==='import'" class="muted">将独立的效果图保存到「{{ plan?.name }}{{ plan?.revision?' · 第 '+plan.revision+' 版':'' }}」 。</p>
      <div class="file-pick" :class="{selected:frontFile}">
        <span class="file-icon"><img v-if="filePreview" :src="filePreview" aria-hidden="true" alt="" /><Icon v-else name="upload" :size="22" /></span>
        <label><strong>{{ frontFile?.name || (modal==='import'?'选择单张效果图':'选择正面照') }}</strong><small>JPG、PNG 或 WebP，10 MB 以内</small>
          <input type="file" :accept="fileTypes" :aria-label="modal==='import'?'效果图':'正面照'" @change="setFile" />
        </label>
      </div>
      <details v-if="modal==='new'" class="conditions extra-photos">
        <summary>添加其他角度 <small>可选</small></summary>
        <label v-for="view in (['left','right','back'] as const)" :key="view">{{ viewName(view) }}<input type="file" :accept="fileTypes" :aria-label="viewName(view)+'照片'" @change="setSide($event,view)" /></label>
      </details>
      <label class="check"><input type="checkbox" v-model="authorized" /><span>{{ modal==='import'?'已核对这是该顾客、该方案的效果图。':'这是本人或已获授权的照片，可保存在这台电脑上做分析。' }}</span></label>
      <template v-if="modal==='new'">
        <p class="workflow-heading"><span>02</span> 选择方案和风格</p>
        <WorkflowControls v-model:settings="suite" v-model:preferences="draftPrefs" />
        <label class="check cloud-choice"><input type="checkbox" v-model="cloudAuthorized" /><span>同意将这些已获授权的照片交给 Codex 生成本案例试戴。</span></label>
      </template>
      <footer class="dialog-actions workflow-footer">
        <button v-if="modal==='new'" type="button" class="btn btn-quiet" @click="create(false)" :disabled="!!busy||!frontFile||!authorized">保存并分析</button>
        <button v-else type="button" class="btn btn-outline" @click="close" :disabled="!!busy">取消</button>
        <button type="submit" class="btn btn-primary" :disabled="!!busy||!frontFile||!authorized||(modal==='new'&&!cloudAuthorized)">
          <Icon v-if="modal==='new'" name="spark" :size="18"/>{{ busy|| (modal==='new'?'生成案例':modal==='front'?'保存新照片并分析':'保存效果图') }}
        </button>
      </footer>
    </form>

    <form v-else-if="modal==='more'" class="form" @submit.prevent="generateMore">
      <p class="muted">沿用当前案例的照片。新一轮和旧方案分开保存。</p>
      <WorkflowControls v-model:settings="suite" v-model:preferences="draftPrefs" :has-baseline="!!current?.baseline" :anchored="!!plan?.image" />
      <label class="check cloud-choice"><input type="checkbox" v-model="cloudAuthorized" /><span>同意使用本案例的参考照片为这轮做新试戴图。</span></label>
      <footer class="dialog-actions workflow-footer"><button type="button" class="btn btn-quiet" @click="recommend" :disabled="!!busy">给我一组新建议</button>
        <button class="btn btn-primary" type="submit" :disabled="!!busy||!cloudAuthorized||workflowBusy"><Icon name="spark" :size="17" />{{ busy||'生成新一组' }}</button></footer>
    </form>

    <form v-else-if="modal==='revise'" class="form" @submit.prevent="revise(true)">
      <p class="muted">以「{{ plan?.name }}」为基础。每次改一处，另存一版。</p>
      <label class="input-label">要改哪里<select v-model="changeField"><option v-for="(label,key) in fields" :key="key" :value="key">{{ label }}</option></select></label>
      <div v-if="plan?.spec[changeField]" class="change-note"><p><span>当前</span>{{ plan.spec[changeField] }}</p></div>
      <label class="input-label">想要的效果<textarea v-model="changeValue" rows="3" maxlength="460" required placeholder="例如：让眉眼更清楚，刘海留薄一点"></textarea></label>
      <label class="check cloud-choice"><input type="checkbox" v-model="cloudAuthorized" /><span>同意用这位顾客的原照和本款参考图做新版试戴。</span></label>
      <footer class="dialog-actions"><button type="button" class="btn btn-quiet" @click="revise(false)" :disabled="!!busy||!changeValue.trim()">保存为新版本</button><button type="submit" class="btn btn-primary" :disabled="!!busy||!changeValue.trim()||!cloudAuthorized||workflowBusy"><Icon name="spark" :size="17"/>{{ busy||'生成新版' }}</button></footer>
    </form>

    <form v-else-if="modal==='single'" class="form" @submit.prevent="generateSingle">
      <p class="muted">制作「{{ plan?.name }}」这一个方案。图会回到当前版本，其他候选可继续查看。</p>
      <label class="check cloud-choice"><input type="checkbox" v-model="cloudAuthorized" /><span>同意使用本案例的参考照片为这款生成试戴。</span></label>
      <footer class="dialog-actions"><button type="button" class="btn btn-outline" @click="close">取消</button><button type="submit" class="btn btn-primary" :disabled="!!busy||!cloudAuthorized||workflowBusy"><Icon name="spark" :size="17"/>{{ busy||'开始生成试戴' }}</button></footer>
    </form>

    <div v-else-if="modal==='handoff'" class="form">
      <p class="muted">为「{{ plan?.name }}{{ plan?.revision?' · 第 '+plan.revision+' 版':'' }}」准备一张试戴图。在 Codex 里发送任务号后才会开始做图。</p>
      <template v-if="!promptTask">
        <label class="check"><input type="checkbox" v-model="authorized" /><span>同意将该顾客本次需要的照片用于 Codex 的云端图像处理。</span></label>
        <footer class="dialog-actions"><button class="btn btn-outline" @click="close" :disabled="!!busy">取消</button><button class="btn btn-primary" @click="makeTask" :disabled="!!busy||!authorized">{{ busy||'准备任务单' }}</button></footer>
      </template>
      <template v-else>
        <label class="input-label">复制到 Codex 对话
          <textarea class="copy-source" readonly :value="promptTask.message" rows="2"></textarea>
        </label>
        <details class="conditions"><summary>查看本次制作说明</summary><pre>{{ promptTask.prompt }}</pre></details>
        <footer class="dialog-actions"><button class="btn btn-outline" @click="close">关闭</button><button class="btn btn-primary" @click="copy(promptTask.message)"><Icon name="copy" :size="17"/>复制任务号</button></footer>
      </template>
    </div>

    <div v-else-if="modal==='preview'&&preview" class="preview-sheet">
      <label v-if="preview.label!=='顾客原照'&&current?.photo" class="check"><input type="checkbox" v-model="compare" />{{ preview.previous?'并排看上一版':'并排看原照' }}</label>
      <div class="preview-images" :class="{compare:compare&&current?.photo}">
        <figure v-if="compare&&current?.photo"><img :src="(preview.previous||current.photo).url" :alt="preview.previous?'上一版试戴':'本人原照'" /><figcaption>{{ preview.previous?'上一版 AI 效果预览':'顾客原照' }}</figcaption></figure>
        <figure><img :src="preview.image.url" :alt="preview.title" /><figcaption>{{ preview.label }}</figcaption></figure>
      </div>
    </div>
  </dialog>
</div>
</template>
