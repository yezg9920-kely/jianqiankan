import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

const cases = await fs.mkdtemp(path.join(os.tmpdir(),'jqq-color-plans-'));
process.env.JQQ_WORKBENCH_CASES = cases;

try {
  const store = await import('./store.ts');
  const { hairColors, hairColorSources } = await import('./color-catalog.ts');
  const { workflowReport } = await import('./workflow-report.ts');
  const makeFixture = (background) =>
    sharp({create:{width:256,height:256,channels:3,background}}).png().toBuffer()
      .then(bytes=>bytes.toString('base64'));
  const ids=hairColors.map(color=>color.id);
  assert.equal(ids.length,12);
  assert.equal(new Set(ids).size,ids.length);
  assert.ok(hairColors.every(color=>color.sourceIds.length && color.sourceIds.every(id=>hairColorSources.some(s=>s.id===id))));

  const front=await makeFixture('#889980');
  const entry=await store.createCase({photo:front,authorized:true,title:'发色流程离线检查'});
  await assert.rejects(store.saveColors(entry.id,{colorIds:['espresso','espresso']}),e=>e.status===422);
  await assert.rejects(store.saveColors(entry.id,{colorIds:['espresso','unknown']}),e=>e.status===422);
  const suggested=await store.recommend(entry.id,{preferences:{}});
  const haircut=suggested.plans[0];
  await assert.rejects(store.saveColors(entry.id,{colorIds:ids,anchorPlanId:haircut.id}),e=>e.status===422);
  const attached=await store.attachImage(entry.id,haircut.id,{photo:await makeFixture('#bf9845'),confirmed:true});
  const oldImage=attached.plans.find(p=>p.id===haircut.id).image;
  const options={colorIds:ids,anchorPlanId:haircut.id};
  const compare=await store.saveColors(entry.id,options);
  const compared=compare.plans.filter(p=>p.round===compare.activeRound);
  assert.equal(compared.length,ids.length);
  assert.ok(compared.every(p=>p.colorBase.photoId===oldImage.id&&!p.image&&Object.keys(p.spec).join() === 'color'));
  assert.equal((await store.saveColors(entry.id,options)).activeRound,compare.activeRound);
  assert.equal(compare.workflows.length,0);
  await assert.rejects(store.saveColors(entry.id,{colorIds:ids,anchorClean:true}),e=>e.status===422);
  const verified=await store.saveColors(entry.id,{...options,anchorClean:true});
  const verifiedPlans=verified.plans.filter(p=>p.round===verified.activeRound);
  assert.notEqual(verified.activeRound,compare.activeRound,'confirming a clean anchor must not replace an earlier round');
  assert.ok(verifiedPlans.every(p=>p.colorBase.cleanPhoto.id===oldImage.id));
  assert.equal((await store.saveColors(entry.id,{...options,anchorClean:true})).activeRound,verified.activeRound);
  const originals=await store.saveColors(entry.id,{colorIds:ids.slice(0,3),preserveOriginal:true});
  const originalMatch=originals.plans.filter(p=>p.round===originals.activeRound);
  const choose=compared.slice(0,3).map(p=>p.id);
  const batch={planIds:choose,cloudAuthorized:true,kind:'color'};
  await assert.rejects(store.reserveWorkflow(entry.id,{...batch,cloudAuthorized:false},'more'),e=>e.status===422);
  await assert.rejects(store.reserveWorkflow(entry.id,{...batch,planIds:[...choose,compared[3].id]},'more'),e=>e.status===422);
  await assert.rejects(store.reserveWorkflow(entry.id,{...batch,planIds:[choose[0],originalMatch[0].id]},'more'),e=>e.status===422);
  await assert.rejects(store.revise(entry.id,choose[0],{field:'length',value:'短发'}),e=>e.status===422);

  // A newer import for the haircut must not change the saved color group's source.
  const oldAnchor=(await store.assetFor(entry.id,oldImage.id)).filename;
  const oldAnchorBytes=await fs.readFile(oldAnchor);
  const identity=(await store.assetFor(entry.id,entry.photo.id)).filename;
  const identityBytes=await fs.readFile(identity);
  await store.attachImage(entry.id,haircut.id,{photo:await makeFixture('#494ab4'),confirmed:true});
  assert.equal((await store.getCase(entry.id)).plans.find(plan=>plan.id===choose[0]).colorBase.photo.id,oldImage.id);
  const pinned=await store.reserveWorkflow(entry.id,{...batch,planIds:verifiedPlans.slice(0,3).map(plan=>plan.id)},'more');
  await store.setWorkflowStage(entry.id,pinned.id,'planning');
  const pinnedPlan=await store.prepareWorkflow(entry.id,pinned.id);
  assert.equal(pinnedPlan.baseline.id,oldImage.id);
  assert.deepEqual(pinnedPlan.slots.map(slot=>slot.role),['look','look','look']);
  await store.setWorkflowStage(entry.id,pinned.id,'making');
  const pinnedInputs=await store.workflowInput(entry.id,pinned.id,pinnedPlan.slots[0].id);
  assert.deepEqual(pinnedInputs.input,[identity,oldAnchor]);
  await store.setWorkflowStage(entry.id,pinned.id,'stopped');
  const run=await store.reserveWorkflow(entry.id,batch,'more');
  await store.setWorkflowStage(entry.id,run.id,'planning');
  const planned=await store.prepareWorkflow(entry.id,run.id);
  assert.equal(planned.round,compare.activeRound);
  assert.equal(planned.baseline,undefined);
  assert.deepEqual(planned.slots.map(s=>s.role),['baseline','look','look']);
  assert.deepEqual(planned.slots.slice(1).map(s=>s.planId),choose.slice(0,2));
  await store.setWorkflowStage(entry.id,run.id,'making');
  await assert.rejects(store.workflowInput(entry.id,run.id,planned.slots[1].id),/先整理.*浅色底图/);
  const backdrop=await store.workflowInput(entry.id,run.id,planned.slots[0].id);
  assert.deepEqual(backdrop.input,[identity,oldAnchor]);
  assert.match(backdrop.prompt,/仅整理背景/);
  assert.match(backdrop.prompt,/#EEEAE4/);
  assert.match(backdrop.prompt,/保留.*当前发色/);
  assert.match(backdrop.prompt,/保留原发型/);
  const cleanFixture=path.join(cases,'clean-anchor-fixture.png');
  await fs.writeFile(cleanFixture,await makeFixture('#eeeae4'),'base64');
  const start=new Date().toISOString();
  const receipt={path:cleanFixture,sessionId:'offline-fixture',fileName:path.basename(cleanFixture),startedAt:start,finishedAt:start};
  await assert.rejects(store.saveWorkflowImage(entry.id,run.id,planned.slots[0].id,{...receipt,path:oldAnchor}),/与参考照相同/);
  const afterBaseline=await store.saveWorkflowImage(entry.id,run.id,planned.slots[0].id,receipt);
  const cleanAnchor=(await store.assetFor(entry.id,afterBaseline.baseline.id)).filename;
  assert.notEqual(cleanAnchor,oldAnchor);
  const previews=await store.getCase(entry.id);
  assert.equal(previews.plans.find(plan=>plan.id===choose[0]).colorBase.photo.id,oldImage.id);
  assert.equal(previews.plans.find(plan=>plan.id===choose[0]).colorBase.cleanPhoto.id,afterBaseline.baseline.id);
  assert.equal(previews.baseline,undefined,'a cleaned haircut is not a replacement for the original hairstyle');
  const firstColor=await store.workflowInput(entry.id,run.id,planned.slots[1].id);
  assert.deepEqual(firstColor.input,[identity,cleanAnchor]);
  assert.match(firstColor.prompt,/只改变头发颜色/);
  assert.match(firstColor.prompt,/保留图 2 已整理的均匀中性浅米灰背景/);
  await store.setWorkflowStage(entry.id,run.id,'stopped');

  // A later batch uses the exact stored neutral image and all three requested color slots.
  const retry=await store.reserveWorkflow(entry.id,batch,'more');
  await store.setWorkflowStage(entry.id,retry.id,'planning');
  const ready=await store.prepareWorkflow(entry.id,retry.id);
  assert.equal(ready.baseline.id,afterBaseline.baseline.id);
  assert.deepEqual(ready.slots.map(s=>s.planId),choose);
  await store.setWorkflowStage(entry.id,retry.id,'making');
  const prompts=await Promise.all(ready.slots.map(s=>store.workflowInput(entry.id,retry.id,s.id)));
  for (const example of prompts) {
    assert.deepEqual(example.input,[identity,cleanAnchor]);
    assert.match(example.prompt,/只改变头发颜色/);
  }
  assert.equal(new Set(prompts.map(p=>p.prompt)).size,3);
  await store.setWorkflowStage(entry.id,retry.id,'stopped');
  const report=await workflowReport(entry.id,retry.id);
  assert.match(report,/发色对照报告/);
  assert.ok(report.includes(afterBaseline.baseline.thumb));
  assert.ok(!report.includes(oldImage.thumb));
  assert.match(report,/香草米金/);

  const task=await store.promptFor(entry.id,originalMatch[0].id,{authorized:true});
  assert.equal(task.references.length,1);
  assert.match(task.prompt,/也是唯一编辑底图/);
  assert.match(task.prompt,/#EEEAE4/);
  assert.match(task.prompt,/不要保留.*原照片的背景/);
  const adjusted=await store.revise(entry.id,choose[0],{field:'color',value:'再浅一点'});
  const revisionTask=await store.promptFor(entry.id,adjusted.planId,{authorized:true});
  assert.equal(revisionTask.references[1].path,cleanAnchor);
  assert.match(revisionTask.prompt,/再浅一点/);

  // A clean original created by the portrait workflow is enough for a later color group.
  const portrait=await store.reserveWorkflow(entry.id,{kind:'cut',cloudAuthorized:true},'more');
  await store.setWorkflowStage(entry.id,portrait.id,'planning');
  const portraitPlan=await store.prepareWorkflow(entry.id,portrait.id);
  const portraitSlot=portraitPlan.slots.find(slot=>slot.role==='baseline');
  assert.ok(portraitSlot);
  await store.setWorkflowStage(entry.id,portrait.id,'making');
  await store.workflowInput(entry.id,portrait.id,portraitSlot.id);
  const portraitFixture=path.join(cases,'clean-original-fixture.png');
  await fs.writeFile(portraitFixture,await makeFixture('#ede9e3'),'base64');
  const cleanOriginal=await store.saveWorkflowImage(entry.id,portrait.id,portraitSlot.id,{...receipt,path:portraitFixture});
  await store.setWorkflowStage(entry.id,portrait.id,'stopped');
  const afterCleanTask=await store.promptFor(entry.id,originalMatch[0].id,{authorized:true});
  assert.notEqual(afterCleanTask.id,task.id);
  assert.equal(afterCleanTask.references[1].role,'baseline');
  const reused=await store.reserveWorkflow(entry.id,{...batch,planIds:originalMatch.map(plan=>plan.id)},'more');
  await store.setWorkflowStage(entry.id,reused.id,'planning');
  const reusedPlan=await store.prepareWorkflow(entry.id,reused.id);
  assert.equal(reusedPlan.baseline.id,cleanOriginal.baseline.id);
  assert.deepEqual(reusedPlan.slots.map(slot=>slot.role),['look','look','look']);
  await store.setWorkflowStage(entry.id,reused.id,'stopped');
  // Tidying is independent of the original portrait and preserves a single structure across colors.
  const tidy=await store.saveColors(entry.id,{colorIds:ids.slice(0,3)});
  const tidyPlans=tidy.plans.filter(plan=>plan.round===tidy.activeRound);
  assert.notEqual(tidy.activeRound,originals.activeRound);
  assert.ok(tidyPlans.every(p=>p.colorBase.tidy&&p.colorBase.cleanPhoto===undefined));
  await assert.rejects(store.promptFor(entry.id,tidyPlans[0].id,{authorized:true}),/制作微整理底图/);
  const tidyRun=await store.reserveWorkflow(entry.id,{...batch,planIds:tidyPlans.map(plan=>plan.id)},'more');
  await store.setWorkflowStage(entry.id,tidyRun.id,'planning');
  const tidyReady=await store.prepareWorkflow(entry.id,tidyRun.id);
  assert.deepEqual(tidyReady.slots.map(slot=>slot.role),['baseline','look','look']);
  await store.setWorkflowStage(entry.id,tidyRun.id,'making');
  const tidyInput=await store.workflowInput(entry.id,tidyRun.id,tidyReady.slots[0].id);
  assert.deepEqual(tidyInput.input,[identity]);
  assert.match(tidyInput.prompt,/微整理基准照.*原生发流/);
  assert.match(tidyInput.prompt,/保持整体长度、发际线.*当前发色/);
  const tidyFixture=path.join(cases,'tidy-fixture.png');
  await fs.writeFile(tidyFixture,await makeFixture('#e9e5df'),'base64');
  const tidyBase=await store.saveWorkflowImage(entry.id,tidyRun.id,tidyReady.slots[0].id,{...receipt,path:tidyFixture});
  const tidyFile=(await store.assetFor(entry.id,tidyBase.baseline.id)).filename;
  assert.notEqual(tidyBase.baseline.id,cleanOriginal.baseline.id);
  const tidyPrompt=await store.workflowInput(entry.id,tidyRun.id,tidyReady.slots[1].id);
  assert.deepEqual(tidyPrompt.input,[identity,tidyFile]);
  assert.match(tidyPrompt.prompt,/只改变头发颜色/);
  await store.setWorkflowStage(entry.id,tidyRun.id,'stopped');
  assert.equal((await store.getCase(entry.id)).baseline.id,cleanOriginal.baseline.id);
  const tidyEdit=await store.revise(entry.id,tidyPlans[0].id,{field:'color',value:'稍稍调冷'});
  assert.ok(tidyEdit.consultation.plans.find(p=>p.id===tidyEdit.planId).colorBase.tidy);
  assert.equal((await store.promptFor(entry.id,tidyEdit.planId,{authorized:true})).references[1].path,tidyFile);
  assert.deepEqual(await fs.readFile(identity),identityBytes);
  assert.deepEqual(await fs.readFile(oldAnchor),oldAnchorBytes);
  await store.updateFront(entry.id,{authorized:true,photo:await makeFixture('#d9a078')});
  await assert.rejects(store.reserveWorkflow(entry.id,batch,'more'),/之前的正面照/);
  console.log('Verified stable neutral backgrounds, source integrity, batch limits, revisions, and color report.');
} finally {
  await fs.rm(cases,{recursive:true,force:true});
}
