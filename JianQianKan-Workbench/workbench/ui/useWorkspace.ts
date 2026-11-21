import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { activeWorkflow, defaults, fields } from '../model';
import type { CaseSummary, Consultation, Field, Photo, Plan, Preferences, WorkflowKind, WorkflowMood, WorkflowRun } from '../model';

type Tab = 'plans' | 'analysis' | 'history';
type Modal = 'new' | 'more' | 'revise' | 'handoff' | 'single' | 'import' | 'front' | 'preview';
type Task = { id:string; message:string; prompt:string; state:'waiting'|'attached' };
type Preview = { title:string; image:Photo; label:string; previous?:Photo };
type Suite = {kind:WorkflowKind;mood:WorkflowMood;previewCount:number};
type WorkflowResponse={consultation:Consultation;runId:string|null;planId?:string;message?:string};
const defaultSuite:Suite={kind:'cut',mood:'natural',previewCount:2};

const views:Record<string,string>={front:'正面',near_front:'近正面',oblique:'斜侧',full_length:'发长参考',left:'左侧',right:'右侧',back:'背面','side-1':'斜侧一','side-2':'斜侧二'};
export const sourceLabels={history:'历史方案',rules:'本机建议',revision:'修改版'};
export const dates=(value?:string)=>value ? value.slice(0,10).replaceAll('-','.'):'';
export const viewName=(value:string)=>views[value]??'原照';

async function fetchApi<T>(suffix:string, body?:unknown):Promise<T>{
  const response=await fetch('/api/cases'+suffix,body===undefined?{}:{
    method:'POST',headers:{'Content-Type':'application/json','X-JQQ-Action':'local'},body:JSON.stringify(body),
  });
  if(!response.ok) {
    const data=await response.json().catch(()=>({}));
    throw new Error(data.message||'暂时无法连接工作台。');
  }
  return response.json();
}
function readFile(file:File){
  if(file.size>10_000_000) return Promise.reject(new Error('图片大于 10 MB，请选择更小的文件。'));
  return new Promise<string>((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=()=>reject(new Error('无法读取图片，请重新选择。'));
    reader.onload=()=>resolve(String(reader.result).split(',')[1]??'');
    reader.readAsDataURL(file);
  });
}

export function useWorkspace() {
  const cases=ref<CaseSummary[]>([]);
  const current=ref<Consultation|null>(null);
  const tab=ref<Tab>('plans'), roundId=ref(''), planId=ref('');
  const busy=ref(''), toast=ref(''), error=ref('');
  const initialized=ref(false);
  const modal=ref<Modal|null>(null), dialog=ref<HTMLDialogElement>();
  const dialogError=ref('');
  const caseTitle=ref(''), frontFile=ref<File|null>(null);
  const ancillary=ref<Record<'left'|'right'|'back',File|null>>({left:null,right:null,back:null});
  const filePreview=ref('');
  const authorized=ref(false),cloudAuthorized=ref(false);
  const suite=ref<Suite>({...defaultSuite});
  const followed=ref('');
  let statusTimer:ReturnType<typeof setInterval>;
  let checkingStatus=false;
  const draftPrefs=ref<Preferences>({...defaults});
  const changeField=ref<Field>('fringe'), changeValue=ref('');
  const promptTask=ref<Task|null>(null);
  const preview=ref<Preview|null>(null), compare=ref(false);
  let toastTimeout:ReturnType<typeof setTimeout>;
  const rounds=computed(()=>current.value?.rounds??[]);
  const plans=computed(()=>current.value?.plans.filter(plan=>plan.round===roundId.value)??[]);
  const plan=computed(()=>plans.value.find(option=>option.id===planId.value)??plans.value.find(option=>option.recommended)??plans.value[0]??null);
  const compactPlans=computed(()=>current.value?.workflows?.some(w=>w.round===roundId.value)
    ? plans.value.filter(p=>!p.image):[]);
  const picturePlans=computed(()=>plans.value.filter(p=>!compactPlans.value.includes(p)));
  const parent=computed(()=>current.value?.plans.find(option=>option.id===plan.value?.parentId));
  const versions=computed(()=>{
    const active=plan.value, all=current.value?.plans??[];
    if(!active)return [];
    const ids=new Set<string>();
    let root=active;
    while(root.parentId&&!ids.has(root.id)){
      ids.add(root.id);const p=all.find(x=>x.id===root.parentId);if(!p)break;root=p;
    }
    ids.clear();ids.add(root.id);
    for(const p of all) if(p.parentId&&ids.has(p.parentId))ids.add(p.id);
    return all.filter(p=>ids.has(p.id));
  });
  const workflowBusy=computed(()=>current.value?.workflows?.some(w=>activeWorkflow(w.stage))??false);
  const workflow=computed(()=>current.value?.workflows?.filter(w=>activeWorkflow(w.stage)).at(-1)
    ??current.value?.workflows?.filter(w=>w.id===followed.value||w.round===roundId.value).at(-1)
    ??(!roundId.value?current.value?.workflows?.at(-1):undefined));
  const report=computed(()=>current.value?.reports.find(r=>r.round===roundId.value)??current.value?.reports[0]);
  const task=computed(()=>current.value?.tasks.filter(t=>t.planId===plan.value?.id).at(-1));
  const originals=computed(()=>{
    const main=current.value?.photo;
    return [...(current.value?.originals??[])].sort((a,b)=>Number(b.id===main?.id)-Number(a.id===main?.id));
  });
  const path=()=>'/'+current.value!.id;
  const planPath=()=>path()+'/plans/'+plan.value!.id;
  function announce(message:string){
    toast.value=message;clearTimeout(toastTimeout);
    toastTimeout=setTimeout(()=>{toast.value='';},3900);
  }
  function setCase(data:Consultation,reset=false, focus?:string){
    current.value=data;
    const index=cases.value.findIndex(c=>c.id===data.id);
    const {id,title,date,count,photo}=data;
    const row={id,title,date,count,photo};
    if(index===-1)cases.value=[row,...cases.value];
    else cases.value=cases.value.map(x=>x.id===id?row:x);
    if(reset||!data.rounds.some(r=>r.id===roundId.value))roundId.value=data.activeRound??'';
    const selected=data.plans.find(p=>p.id===focus);
    if(selected){ roundId.value=selected.round;planId.value=selected.id; }
    else if(reset||!plans.value.some(p=>p.id===planId.value)){
      planId.value=plans.value.find(p=>p.recommended)?.id??plans.value[0]?.id??'';
    }
    remember();
  }
  function remember(){
    const id=current.value?.id;
    if(!id)return;
    // Keep the explicit case link and the active case in sync across refresh.
    const url=new URL(location.href);
    if(url.searchParams.get('case')!==id){
      url.searchParams.set('case',id);
      history.replaceState(null,'',url);
    }
    try{
      localStorage.setItem('jqq.workbench.case',id);
      localStorage.setItem('jqq.workbench.view.'+id,JSON.stringify({plan:planId.value,round:roundId.value}));
    }catch{}
  }
  function restore(data:Consultation){
    let saved: {plan?:string; round?:string} = {};
    try{saved=JSON.parse(localStorage.getItem('jqq.workbench.view.'+data.id)??'{}')??{};}catch{}
    setCase(data,true,saved.plan);
    if(!saved.plan&&saved.round&&data.rounds.some(round=>round.id===saved.round)) chooseRound(saved.round);
  }
  async function perform(label:string,action:()=>Promise<void>, destination:'modal'|'page'='page'){
    if(busy.value)return;
    busy.value=label;error.value='';dialogError.value='';
    try{await action();}
    catch(e){
      const message=e instanceof Error?e.message:'这次操作未完成，请再试。';
      if(destination==='modal'&&modal.value) dialogError.value=message;
      else error.value=message;
    }finally{busy.value='';}
  }
  async function start(){
    await perform('正在打开已保存案例', async()=>{
      cases.value=await fetchApi<CaseSummary[]>('');
      let local='';
      try{local=localStorage.getItem('jqq.workbench.case')??'';}catch{}
      const requested=new URLSearchParams(location.search).get('case');
      const id=cases.value.find(c=>c.id===requested)?.id??cases.value.find(c=>c.id===local)?.id??cases.value[0]?.id;
      if(id)restore(await fetchApi<Consultation>('/'+id));
    });
    initialized.value=true;
  }
  const chooseCase=(id:string)=>perform('正在读取案例',async()=>{
    const data=await fetchApi<Consultation>('/'+id);
    followed.value='';tab.value='plans';restore(data);
  });
  const chooseRound=(id:string)=>{
    followed.value='';roundId.value=id;planId.value=plans.value.find(p=>p.recommended)?.id??plans.value[0]?.id??'';
    tab.value='plans';remember();
  };
  function choosePlan(id:string,inspect=false){
    const found=current.value?.plans.find(p=>p.id===id);
    if(!found)return;
    followed.value='';roundId.value=found.round;planId.value=id;tab.value='plans';remember();
    if(inspect && window.matchMedia('(max-width:575px)').matches) nextTick(()=>{
      document.querySelector('.inspector')?.scrollIntoView({block:'start',behavior:'auto'});
    });
  }
  const refresh=()=>perform('正在刷新',async()=>{
    if(!current.value)return;
    setCase(await fetchApi<Consultation>(path()));announce('已读回最新记录。');
  });
  function setFile(ev:Event){
    frontFile.value=(ev.target as HTMLInputElement).files?.[0]??null;
    if(filePreview.value) URL.revokeObjectURL(filePreview.value);
    filePreview.value=frontFile.value?URL.createObjectURL(frontFile.value):'';
  }
  function setSide(ev:Event,key:'left'|'right'|'back'){
    ancillary.value[key]=(ev.target as HTMLInputElement).files?.[0]??null;
  }
  function clearModal(){
    if(filePreview.value)URL.revokeObjectURL(filePreview.value);
    filePreview.value='';modal.value=null;
  }
  function close(){if(dialog.value?.open)dialog.value.close();else clearModal();}
  async function show(mode:Modal){
    dialogError.value='';authorized.value=false;cloudAuthorized.value=false;frontFile.value=null;compare.value=false;
    suite.value=mode==='new'?{...defaultSuite}:{...defaultSuite,mood:workflow.value?.mood??'natural',kind:workflow.value?.kind??'cut'};
    caseTitle.value='';ancillary.value={left:null,right:null,back:null};
    draftPrefs.value={...(mode==='new'?defaults:current.value?.preferences??defaults)};
    changeField.value='fringe';changeValue.value='';promptTask.value=null;
    modal.value=mode;
    await nextTick();
    dialog.value?.showModal();
  }
  async function view(image:Photo,title:string,label='AI效果预览',previous?:Photo){
    preview.value={title,image,label,previous};await show('preview');
    if(previous)compare.value=true;
  }
  function begin(reply:WorkflowResponse, reset:boolean){
    followed.value=reply.runId??'';
    const run=reply.consultation.workflows.find(w=>w.id===reply.runId);
    setCase(reply.consultation,reset,reply.planId??run?.slots.find(s=>s.role==='look')?.planId);
    tab.value='plans';close();
    if(reply.message) error.value=reply.message;
    else announce('已开始这轮发型工作流。');
  }
  const generateInputs=()=>({ ...suite.value, preferences:draftPrefs.value,cloudAuthorized:cloudAuthorized.value});
  const create=(withImages=false)=>perform('正在保存照片',async()=>{
    if(!frontFile.value||!authorized.value||(withImages&&!cloudAuthorized.value))return;
    const additionalPhotos=[];
    for(const [view,file] of Object.entries(ancillary.value)) if(file)additionalPhotos.push({view,photo:await readFile(file)});
    const body={ ...generateInputs(),title:caseTitle.value,photo:await readFile(frontFile.value),authorized:authorized.value,additionalPhotos };
    if(withImages){
      begin(await fetchApi<WorkflowResponse>('/generate',body),true);return;
    }
    const data=await fetchApi<Consultation>('',body);
    setCase(data,true);tab.value='analysis';close();
    const analyzed=await fetchApi<Consultation>(path()+'/analyze',{});
    setCase(analyzed);
    if(analyzed.analysis?.status==='ready'){
      const result=await fetchApi<Consultation>(path()+'/recommend',{preferences:analyzed.preferences});
      setCase(result,true);tab.value='plans';announce('案例已建立，首组选款建议已保存。');
    }else announce('原照已保存。换一张正面照后可以重新分析。');
  },'modal');
  const generateMore=()=>perform('正在建立本轮生成任务', async()=>{
    if(!cloudAuthorized.value)return;
    begin(await fetchApi<WorkflowResponse>(path()+'/generate',{
      ...generateInputs(),anchorPlanId:plan.value?.image?plan.value.id:undefined,
    }),false);
  },'modal');
  const generateSingle=()=>perform('正在建立试戴任务',async()=>{
    if(!cloudAuthorized.value||!plan.value)return;
    begin(await fetchApi<WorkflowResponse>(path()+'/generate',{...generateInputs(),planId:plan.value.id}),false);
  },'modal');
  const stop=()=>perform('正在停止这轮',async()=>{
    if(!workflow.value||!activeWorkflow(workflow.value.stage))return;
    setCase(await fetchApi<Consultation>(path()+'/workflows/'+workflow.value.id+'/stop',{}));
    announce('已保留完成的试戴图。');
  });
  async function poll(){
    const id=current.value?.id;
    if(checkingStatus||busy.value||!id||!current.value?.workflows?.some(w=>activeWorkflow(w.stage)))return;
    checkingStatus=true;
    try{
      const checked=await fetchApi<Consultation>('/'+id);
      if(current.value?.id!==id||busy.value)return;
      const active=checked.workflows.find(w=>w.id===followed.value);
      const previous=current.value?.workflows?.find(w=>w.id===followed.value);
      if(active?.round&&(!previous?.round||!roundId.value)){
        const chosen=active.slots.find(s=>s.role==='look')?.planId;
        setCase(checked,false,chosen);
      } else setCase(checked);
      if(active&&previous&&activeWorkflow(previous.stage)&&!activeWorkflow(active.stage)){
        if(active.stage==='ready')announce('试戴图已回到案例，可以打开本轮报告。');
        if(active.stage==='retake') tab.value='analysis';
      }
    }catch{/* A missing poll can be refreshed without losing the case. */}
    finally{checkingStatus=false;}
  }
  const analyze=()=>perform('正在本机查看轮廓',async()=>{
    setCase(await fetchApi<Consultation>(path()+'/analyze',{}));announce('这次照片观察已记入案例。');
  });
  const updateFront=()=>perform('正在保存新正面照',async()=>{
    if(!frontFile.value||!authorized.value)return;
    setCase(await fetchApi<Consultation>(path()+'/front',{photo:await readFile(frontFile.value),authorized:authorized.value}));
    close();tab.value='analysis';
    setCase(await fetchApi<Consultation>(path()+'/analyze',{}));announce('已用新正面照重新分析。');
  },'modal');
  const recommend=()=>perform('正在整理新的剪裁方向',async()=>{
    const data=await fetchApi<Consultation>(path()+'/recommend',{preferences:draftPrefs.value});
    setCase(data,true);tab.value='plans';close();announce('已保存一组新建议。');
  },'modal');
  const revise=(generate=false)=>perform('正在建立新版本',async()=>{
    if(generate&&!cloudAuthorized.value)return;
    const data=await fetchApi<WorkflowResponse>(planPath()+'/revise',{field:changeField.value,value:changeValue.value,generate,
      cloudAuthorized:cloudAuthorized.value,mood:workflow.value?.mood});
    if(generate)begin(data,false);
    else {setCase(data.consultation,false,data.planId);close();announce('已另存一个版本，可以随时回看上版。');}
  },'modal');
  const select=()=>perform('正在保存备选',async()=>{
    setCase(await fetchApi<Consultation>(planPath()+'/select',{}));announce('已记为备选方案。');
  });
  const makeTask=()=>perform('正在准备任务单',async()=>{
    promptTask.value=await fetchApi<Task>(planPath()+'/prompt',{authorized:authorized.value});
    setCase(await fetchApi<Consultation>(path()));
  },'modal');
  const attach=()=>perform('正在回填试戴图',async()=>{
    if(!frontFile.value||!authorized.value)return;
    setCase(await fetchApi<Consultation>(planPath()+'/image',{photo:await readFile(frontFile.value),confirmed:authorized.value}));
    close();announce('效果图已保存到此版本，等待核对。');
  },'modal');
  async function copy(value:string){
    try {await navigator.clipboard.writeText(value);announce('已复制。');}
    catch {
      const field=dialog.value?.querySelector<HTMLTextAreaElement>('textarea.copy-source');
      field?.focus();field?.select();announce('请按 ⌘C 复制选中的内容。');
    }
  }
  onMounted(()=>{void start();statusTimer=setInterval(()=>void poll(),1750);});
  onUnmounted(()=>{clearInterval(statusTimer);clearTimeout(toastTimeout);if(filePreview.value)URL.revokeObjectURL(filePreview.value);});
  return {cases,current,tab,roundId,planId,busy,toast,error,initialized,modal,dialog,dialogError,caseTitle,frontFile,
    ancillary,filePreview,authorized,cloudAuthorized,suite,draftPrefs,changeField,changeValue,promptTask,preview,compare,rounds,plans,compactPlans,picturePlans,plan,parent,
    versions,report,task,workflow,workflowBusy,originals,chooseCase,chooseRound,choosePlan,refresh,setFile,setSide,clearModal,close,show,view,create,
    analyze,updateFront,recommend,generateMore,generateSingle,stop,revise,select,makeTask,attach,copy,start};
}
