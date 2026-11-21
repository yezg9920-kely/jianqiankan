import { workflowKinds, workflowMoods } from './model';
import { getCase, Problem } from './store';
const e=(a:unknown)=>String(a??'').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]??c));
export async function workflowReport(caseId:string,id:string){
  const current=await getCase(caseId);
  const run=current.workflows.find(r=>r.id===id);
  if(!run)throw new Problem(404,'找不到这轮报告。');
  const attached=run.slots.filter(s=>s.role==='look'&&s.picture);
  const lookSlots=run.slots.filter(s=>s.role==='look');
  const source=run.analysis;
  const plans=current.plans.filter(p=>p.round===run.round);
  let cards='';
  for(const slot of lookSlots){
    const p=plans.find(p=>p.id===slot.planId);
    cards+='<article>'+(slot.picture?'<img alt="'+e(slot.name)+'" src="'+e(slot.picture.url)+'">':'<div class="empty">本款尚无试戴图</div>')+
       '<div class="cardtext"><div class="code">'+e(p?.code)+'　'+(slot.picture?'AI 效果预览':'设计方向')+'</div><h3>'+e(slot.name)+'</h3><p>'+e(p?.description||slot.message)+'</p>'+
       (p?.change?'<p class="delta">本次调整：'+e(p.change.after)+'</p>':'')+'</div></article>';
  }
  const panel=run.slots.find(s=>s.role==='baseline')?.picture??run.baseline;
  const status=attached.length+' 张试戴图'+(lookSlots.length&&attached.length<lookSlots.length?' · 含尚未完成的选项':'');
  return '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
  '<title>发型设计报告 · 剪前看看</title><style>'+
  ':root{background:#e9e3d7;color:#28342d;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;font-size:15px}*{box-sizing:border-box}body{margin:0}main{background:#f8f4e9;max-width:1040px;margin:24px auto;padding:27px 36px 30px;border-top:3px solid #425e4a}h1,h2,h3{font-family:"Songti SC",serif;margin:0}h1{font-size:clamp(34px,5vw,55px);margin:14px 0 3px}.meta{display:flex;justify-content:space-between;color:#54685a;font-size:12px}.sub{color:#4b5f51}section{border-top:1px solid #d8cfbb;margin-top:23px;padding-top:13px}h2{font-size:24px;margin-bottom:10px}.summary{display:grid;grid-template-columns:minmax(120px,.3fr) minmax(0,1fr);gap:15px;align-items:start}.summary img,article img{width:100%;object-fit:contain;background:#e8ddcf;aspect-ratio:3/4}p{line-height:1.6;margin:5px 0}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}article{background:#fffaf0;border:1px solid #ded3bf}.cardtext{padding:9px}h3{font-size:20px}.code,.caption{font-size:11px;color:#536b57}.empty{min-height:160px;display:grid;place-content:center;background:#eae6dc;font-size:12px}.delta{color:#42654e}.foot{border-top:1px solid #d8cfbb;margin-top:16px;padding-top:8px;color:#516053;font-size:11px}@media(max-width:650px){main{margin:0;padding:18px}.grid{grid-template-columns:1fr 1fr}.summary{grid-template-columns:115px 1fr}.meta{font-size:10px}}@media print{@page{size:A4 portrait;margin:9mm}main{margin:0;max-width:none;padding:0}article{break-inside:avoid}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}.desktop{display:none}}'+
  '</style><main><div class="meta"><b>剪前看看　/　个人造型档案</b><span>'+e(run.createdAt.slice(0,10))+'　·　AI 效果预览</span></div>'+
  '<h1>发型设计报告</h1><p class="sub">'+e(current.title)+'　/　'+e(workflowKinds[run.kind].name)+'　/　'+e(workflowMoods[run.mood])+'</p>'+
  '<p class="caption">'+e(status)+(run.message?'　'+e(run.message):'')+'</p><section><h2>01　分析与设计条件</h2><div class="summary">'+
  (panel?'<div><img src="'+e(panel.thumb)+'" alt="剪前基准照"><p class="caption">AI 整理基准照</p></div>':'<div class="empty">基准照待制作</div>')+
  '<div><p> '+e(run.preferences.direction)+' · '+e(run.preferences.targetLength)+' · '+e(run.preferences.fringe)+'</p>'+
  (run.preferences.goal?'<p>'+e(run.preferences.goal)+'</p>':'')+
  (source?source.findings.map(x=>'<p><b>'+e(x.label)+'：</b>'+e(x.detail||x.value)+'</p>').join(''):'<p>这轮没有写入单独的轮廓记录。</p>')+
  '</div></div></section><section><h2>02　发型试戴</h2><div class="grid">'+(cards||'<p>本轮尚未进入试戴制作。</p>')+'</div></section>'+
  '<div class="foot">剪前参考 · 以本人和发型师现场核对为准。<span class="desktop">　⌘P 可打印或保存为 PDF。　<a href="/?case='+e(caseId)+'">返回案例</a></span></div></main></html>';
}

