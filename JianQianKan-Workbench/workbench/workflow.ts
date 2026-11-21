import { activeWorkflow } from './model';
import type { WorkflowRun } from './model';
import { checkCodex,codexImage } from './codex-image';
import { analyzeCase,createCase,failWorkflowSlot,getCase,prepareWorkflow,Problem,reserveWorkflow,revise,saveWorkflowImage,setWorkflowStage,workflowInput } from './store';

const running=new Map<string,{caseId:string;stop:AbortController}>();
let queue:Promise<void>=Promise.resolve();
const record=(body:unknown)=>(body&&typeof body==='object'?body:{}) as Record<string,unknown>;
const message=(e:unknown)=>e instanceof Problem ? e.message : '这一步没有完成，已经保存的照片和结果仍可查看。';

function enqueue(caseId:string,run:WorkflowRun,exe:string){
  const stop=new AbortController();
  running.set(run.id,{caseId,stop});
  const launch=async()=>{
    if(stop.signal.aborted)return;
    try{
      await setWorkflowStage(caseId,run.id,'checking');
      const old=await getCase(caseId);
      const checked=(run.purpose==='new'||!old.analysis)?await analyzeCase(caseId):old;
      if(stop.signal.aborted)return;
      if(checked.analysis?.status==='retake'){
        await setWorkflowStage(caseId,run.id,'retake',checked.analysis.advice);
        return;
      }
      await setWorkflowStage(caseId,run.id,'planning');
      const ready=await prepareWorkflow(caseId,run.id);
      if(stop.signal.aborted)return;
      await setWorkflowStage(caseId,run.id,'making');
      let pictures=0,failures=0,baseSkipped=false;
      for(const slot of ready.slots){
        if(stop.signal.aborted)return;
        try{
          if(baseSkipped)throw new Problem(409,'基准照没有做出来，暂停这轮试戴。');
          const input=await workflowInput(caseId,run.id,slot.id);
          const output=await codexImage(exe,input,stop.signal);
          if(stop.signal.aborted)return;
          await saveWorkflowImage(caseId,run.id,slot.id,output);
          if(slot.role==='look')pictures++;
        }catch(e){
          if(stop.signal.aborted)return;
          failures++;
          if(slot.role==='baseline')baseSkipped=true;
          await failWorkflowSlot(caseId,run.id,slot.id,message(e));
        }
      }
      if(!stop.signal.aborted)await setWorkflowStage(caseId,run.id,pictures?failures?'partial':'ready':'failed',
        pictures?failures?'已保存完成的试戴图，可以继续从这些图选择。':undefined:'没有成功保存试戴图，可以打开单图状态查看原因。');
    }catch(e){
      if(!stop.signal.aborted)await setWorkflowStage(caseId,run.id,'failed',message(e)).catch(()=>{});
    }
  };
  const job=queue.catch(()=>{}).then(launch).finally(()=>{running.delete(run.id);});
  queue=job;
}
function consent(body:unknown){
  if(record(body).cloudAuthorized!==true)throw new Problem(422,'请确认这次可把照片交给 Codex 制作发型试戴。');
}
export async function generateNewCase(body:unknown){
  consent(body);
  const exe=await checkCodex();
  const data=await createCase(body);
  try{
    const run=await reserveWorkflow(data.id,body,'new');
    enqueue(data.id,run,exe);
    return {consultation:await getCase(data.id),runId:run.id};
  }catch(e){
    return {consultation:await getCase(data.id),runId:null,message:message(e)};
  }
}
export async function generateExisting(caseId:string,body:unknown){
  consent(body);
  const exe=await checkCodex();
  const p=record(body);
  const chosen=typeof p.planId==='string'?p.planId:undefined;
  const run=await reserveWorkflow(caseId,body,chosen?'single':'more',chosen);
  enqueue(caseId,run,exe);
  return {consultation:await getCase(caseId),runId:run.id};
}
export async function generateRevision(caseId:string,planId:string,body:unknown){
  consent(body);
  const now=await getCase(caseId);
  if(now.workflows.some(w=>activeWorkflow(w.stage)))throw new Problem(409,'请等当前这轮完成后再生成新版。');
  const exe=await checkCodex();
  const change=await revise(caseId,planId,body);
  const run=await reserveWorkflow(caseId,body,'revision',change.planId);
  enqueue(caseId,run,exe);
  return {consultation:await getCase(caseId),planId:change.planId,runId:run.id};
}
export async function stopWorkflow(caseId:string,id:string){
  const current=running.get(id);
  if(!current||current.caseId!==caseId)throw new Problem(409,'这一轮已经结束。');
  current.stop.abort();
  await setWorkflowStage(caseId,id,'stopped','已停止未完成的试戴，已保存的结果不变。');
  return getCase(caseId);
}

