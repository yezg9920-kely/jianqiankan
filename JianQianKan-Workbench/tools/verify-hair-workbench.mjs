import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {constants} from 'node:fs';
import * as fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';

const args=process.argv.slice(2);
const dirArg=args.indexOf('--directory');
const fromSource=dirArg!==-1;
const input=fromSource?args[dirArg+1]:args.find(x=>!x.startsWith('--'));
if(!input) throw new Error('用法: node tools/verify-hair-workbench.mjs <工作台ZIP> [--no-browser] 或 --directory <工作台目录> --no-browser');
const source=path.resolve(input);
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'剪前看看 工作台 解压校验 '));
const root=path.join(temp,'JianQianKan-Workbench');
const win=process.platform==='win32';
let server,browser;
try {
  if(fromSource) {
    await fs.cp(source,root,{recursive:true,filter:file=>{
      const rel=path.relative(source,file);
      return !rel.split(path.sep).some(n=>['node_modules','private-workspace','.git','exports','dist','__pycache__'].includes(n)||n.startsWith('.env'));
    }});
  } else if(process.platform==='darwin') execFileSync('/usr/bin/ditto',['-x','-k',source,temp]);
  else execFileSync(win?'tar.exe':'unzip',win?['-xf',source,'-C',temp]:['-q',source,'-d',temp]);
  const macLauncher=path.join(root,'打开剪前看看工作台.command');
  const windowsLauncher='Start Workbench.cmd';
  await fs.access(path.join(root,windowsLauncher));
  const manifest = !fromSource
    ? JSON.parse(await fs.readFile(path.join(root,'MANIFEST.json'),'utf8'))
    : { version:JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8')).version, sha256:{} };
  const hash=v=>createHash('sha256').update(v).digest('hex');
  for(const [file,checksum] of Object.entries(manifest.sha256)){
    assert.equal(hash(await fs.readFile(path.join(root,file))),checksum,file);
  }
  if(process.platform==='darwin') await fs.access(macLauncher,constants.X_OK);
  for(const name of ['node_modules','private-workspace','.env','.git','.npmrc']) await assert.rejects(fs.access(path.join(root,name)));
  const bind=net.createServer();
  await new Promise(resolve=>bind.listen(0,'127.0.0.1',resolve));
  const port=bind.address().port;
  await new Promise(resolve=>bind.close(resolve));
  const origin='http://127.0.0.1:'+port;
  const env={...process.env,JQQ_WORKBENCH_PORT:String(port)};
  delete env.JQQ_WORKBENCH_CASES;
  if(win) {
    // The command is fixed and the Unicode/spaces are in the working directory,
    // not interpolated into CMD source. /s strips the outer pair of quotes.
    const command='""Start Workbench.cmd" --no-open"';
    server=spawn(process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe',['/d','/s','/c',command],{
      cwd:root,env,stdio:['ignore','pipe','pipe'],windowsVerbatimArguments:true,
    });
  } else if(process.platform==='darwin') {
    server=spawn(macLauncher,['--no-open'],{cwd:temp,env,stdio:['ignore','pipe','pipe']});
  } else {
    server=spawn(process.execPath,['tools/start-release.mjs','--no-open'],{cwd:root,env,stdio:['ignore','pipe','pipe']});
  }

  let log='', spawnError;
  server.once('error',e=>{spawnError=e});
  server.stdout.on('data',b=>{log=(log+String(b)).slice(-20000);});
  server.stderr.on('data',b=>{log=(log+String(b)).slice(-20000);});
  const until=Date.now()+200000;
  while(true){
    if(spawnError) throw spawnError;
    if(server.exitCode!==null) throw new Error('工作台启动失败：\n'+log);
    const healthy=await fetch(origin+'/health',{signal:AbortSignal.timeout(1500)})
      .then(r=>r.json()).then(r=>r.app==='jianqiankan-workbench').catch(()=>false);
    if(healthy)break;
    if(Date.now()>until) throw new Error('工作台启动超时：\n'+log);
    await new Promise(resolve=>setTimeout(resolve,300));
  }
  assert.match(log,/首次启动/);
  assert.equal((await fetch(origin+'/api/cases')).status,403);
  const initial=await fetch(origin+'/');
  assert.equal(initial.status,200);
  const entry=await initial.text();
  assert.ok(entry.includes('/assets/') && entry.includes('id="app"'));
  const cookie=initial.headers.get('set-cookie').split(';')[0];
  const local={Cookie:cookie,Origin:origin,'X-JQQ-Action':'local','Content-Type':'application/json'};
  const list=await fetch(origin+'/api/cases',{headers:{Cookie:cookie}}).then(r=>r.json());
  assert.deepEqual(list,[]);

  let checkedBrowser=false;
  if(!args.includes('--no-browser')) {
    const {chromium,expect}=await import('@playwright/test');
    browser=await chromium.launch({channel:'chrome',headless:true});
    const page=await browser.newPage({viewport:{width:1180,height:800}});
    const errors=[], remote=[];
    page.on('pageerror',err=>errors.push(err.message));
    page.on('request',r=>{if(!r.url().startsWith(origin))remote.push(r.url());});
    await page.goto(origin,{waitUntil:'networkidle'});
    await expect(page.getByRole('button',{name:'新建案例',exact:true}).first()).toBeVisible();
    await page.getByRole('button',{name:'新建案例',exact:true}).first().click();
    const form=page.getByRole('dialog');
    await expect(form.getByRole('button',{name:'生成案例',exact:true})).toBeDisabled();
    await expect(form.getByRole('button',{name:/发型＋发色/})).toBeVisible();
    await expect(form.getByRole('button',{name:'自然松弛',exact:false}).or(form.getByRole('button',{name:'顺势自然',exact:true}))).toBeVisible();
    assert.deepEqual(errors,[]);
    assert.deepEqual(remote,[]);
    checkedBrowser=true;
  }

  // Non-portrait fixture: exercises decoder, case permissions, filesystem,
  // and available local photo-analysis adapter without private images.
  const sharp=createRequire(path.join(root,'package.json'))('sharp');
  const bytes=await sharp({create:{width:256,height:256,channels:3,background:'#889980'}}).png().toBuffer();
  const create=await fetch(origin+'/api/cases',{method:'POST',headers:local,body:JSON.stringify({
    title:'离线测试 · 无人像',authorized:true,photo:bytes.toString('base64')
  })});
  const caseResult=await create.json();
  assert.equal(create.status,201,JSON.stringify(caseResult));
  assert.match(caseResult.id,/^case-/);
  const analyze=await fetch(origin+'/api/cases/'+caseResult.id+'/analyze',{method:'POST',headers:local,body:'{}'});
  const analysis=await analyze.json();
  assert.equal(analyze.status,200,JSON.stringify(analysis));
  assert.equal(analysis.analysis.status,'retake');
  if(win) assert.equal(analysis.analysis.source,'portable');
  else assert.ok(['vision','portable'].includes(analysis.analysis.source));
  const saved=JSON.parse(await fs.readFile(path.join(root,'private-workspace/hair-consultation',caseResult.id,'case.json'),'utf8'));
  assert.equal(saved.authorization.cloud_processing_approved,false);
  const caseURL=origin+'/api/cases/'+caseResult.id;
  async function post(route,body,status) {
    const response=await fetch(caseURL+'/'+route,{method:'POST',headers:local,body:JSON.stringify(body)});
    const data=await response.json();
    assert.equal(response.status,status,JSON.stringify(data));
    return data;
  }
  const first=await post('recommend',{preferences:{direction:'女生发型',currentLength:'长发',dye:true}},200);
  const second=await post('recommend',{preferences:{targetLength:'中长发',styling:true,goal:'柔和层次'}},200);
  assert.ok(first.plans.length>0 && second.plans.length>first.plans.length);
  assert.equal(second.rounds.length,2);
  assert.equal(new Set(second.plans.map(plan=>plan.id)).size,second.plans.length);
  assert.equal(new Set(second.plans.map(plan=>plan.name)).size,second.plans.length);
  const chosen=first.plans[0].id;
  const revised=await post('plans/'+chosen+'/revise',{field:'color',value:'冷栗棕测试色'},201);
  const selected=await post('plans/'+revised.planId+'/select',{},200);
  assert.equal(selected.selected,revised.planId);
  const reopened=await fetch(caseURL,{headers:{Cookie:cookie}}).then(r=>r.json());
  assert.equal(reopened.plans.find(plan=>plan.id===revised.planId)?.parentId,chosen);
  assert.equal(reopened.plans.find(plan=>plan.id===revised.planId)?.spec.color,'冷栗棕测试色');
  assert.equal(reopened.selected,revised.planId);
  const reject=await fetch(origin+'/api/cases/generate',{method:'POST',headers:local,body:JSON.stringify({authorized:true,photo:bytes.toString('base64')})});
  assert.equal(reject.status,422);
  assert.match(JSON.stringify(await reject.json()),/确认/);
  const current=await fetch('http://127.0.0.1:4322/health',{signal:AbortSignal.timeout(1500)}).then(r=>r.json()).catch(()=>null);
  console.log(JSON.stringify({release:manifest.version,platform:process.platform,arch:process.arch,node:process.version,manifestFiles:Object.keys(manifest.sha256).length,
    launcher:'native',firstLaunchDependencies:true,chromeForm:checkedBrowser,cleanCaseStore:true,
    localAnalysisNonPortrait:'retake',localAnalysisSource:analysis.analysis.source,caseHistory:true,recommendationRounds:2,
    revisionAndSelectionPersisted:true,cloudGenerationCalls:0,sourceServerHealthy:current?.ok??null},null,2));
} finally {
  await browser?.close();
  if(server?.pid && server.exitCode===null && server.signalCode===null){
    const done=new Promise(resolve=>server.once('exit',resolve));
    if(win) {
      // The Windows batch/native Node pair lives under this test's own CMD PID.
      try{execFileSync('taskkill.exe',['/PID',String(server.pid),'/T','/F'],{stdio:'ignore'});}
      catch{server.kill('SIGTERM');}
    } else server.kill('SIGTERM');
    await done;
  }
  await fs.rm(temp,{recursive:true,force:true,maxRetries:6,retryDelay:250});
}
