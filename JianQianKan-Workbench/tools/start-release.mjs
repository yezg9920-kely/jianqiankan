import { spawn, execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.JQQ_WORKBENCH_PORT || 4332);
const endpoint = 'http://127.0.0.1:'+port+'/';
const open = process.argv.includes('--open') && !process.argv.includes('--no-open');
const exists = filename=>access(filename).then(()=>true,()=>false);

function command(program,args,stdio='inherit') {
  return new Promise(resolve=>{
    const child=spawn(program,args,{cwd:root,stdio});
    child.once('error',()=>resolve(1));
    child.once('exit',code=>resolve(code??1));
  });
}

async function npm(args) {
  // Native Windows installations ship npm.cmd (which cannot be passed to
  // execFile). Resolve the executable JS entry and use the current Node.
  for(const entry of [
    process.env.npm_execpath,
    ...[path.dirname(process.execPath), ...String(process.env.PATH||'').split(path.delimiter).map(p=>p.replace(/^"|"$/g,''))].filter(Boolean)
      .map(dir=>path.join(dir,'node_modules','npm','bin','npm-cli.js')),
  ]) {
    if(entry?.endsWith('npm-cli.js') && await exists(entry)) return command(process.execPath,[entry,...args]);
  }
  if(process.platform==='win32') {
    throw new Error('找不到 npm 的 Node.js 入口。请安装包含 npm 的 Node.js 22 或以上版本。');
  }
  return command('npm',args);
}

function browse() {
  if(!open) return;
  const onError=error=>{
    if(error) console.error('请手动打开 '+endpoint);
  };
  if(process.platform==='win32') {
    const powershell=path.join(process.env.SystemRoot || 'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
    // The only interpolation is a validated, numeric loopback port.
    execFile(powershell,['-NoProfile','-NonInteractive','-Command',"Start-Process '"+endpoint+"'"],onError);
  } else if(process.platform==='darwin') execFile('/usr/bin/open',[endpoint],onError);
  else execFile('xdg-open',[endpoint],onError);
}

async function main() {
  if(Number(process.versions.node.split('.')[0])<22) throw new Error('请使用 Node.js 22 或以上版本。');
  if(!Number.isInteger(port)||port<1024||port>65535) throw new Error('JQQ_WORKBENCH_PORT 必须是 1024–65535 内的端口。');
  const needsBuild=!(await exists(path.join(root,'dist/workbench/index.html')));
  const checkCode=`
    const assert = require('node:assert/strict');
    const path = require('node:path');
    const manifest = require('./package.json');
    const deps = manifest.dependencies;
    if (process.argv[1] === 'build') Object.assign(deps, manifest.devDependencies);
    for (const name of Object.keys(deps)) {
      const installed = require(path.join(process.cwd(), 'node_modules', name, 'package.json'));
      assert.equal(installed.version, deps[name]);
    }
    require('sharp');
    const human = require.resolve('@vladmandic/human');
    require.resolve(path.join(path.dirname(human), 'human.node-wasm.js'));
  `;
  const check=['--import','tsx','-e',checkCode,needsBuild?'build':'runtime'];
  if(await command(process.execPath,check,'ignore')) {
    console.log('首次启动，正在按锁定版本安装'+(needsBuild?'本地构建与运行':'本地运行')+'依赖…');
    if(await npm(['ci',needsBuild?'--include=dev':'--omit=dev','--include=optional','--ignore-scripts','--no-audit','--no-fund']))
      throw new Error('依赖安装失败。请检查网络与目录写入权限，然后重开工作台。');
  }
  if(needsBuild) {
    console.log('正在构建工作台界面…');
    if(await npm(['run','build:workbench'])) throw new Error('工作台界面构建失败。请查看终端输出。');
  }
  if(process.argv.includes('--build-only')) return;

  const instance=spawn(process.execPath,['--import','tsx','workbench/server.ts'],{
    cwd:root,stdio:['inherit','pipe','inherit'], env:{...process.env,JQQ_WORKBENCH_PORT:String(port)},
  });
  let opened=false, bootText='';
  instance.stdout.on('data',chunk=>{
    process.stdout.write(chunk);
    if(!opened) {
      bootText=(bootText+String(chunk)).slice(-2048);
      if(bootText.includes(endpoint)) { opened=true; browse(); }
    }
  });
  instance.once('error',error=>{
    console.error('工作台没能启动：'+error.message);
    process.exitCode=1;
  });
  const stop=()=>instance.kill('SIGTERM');
  process.once('SIGINT',stop);
  process.once('SIGTERM',stop);
  instance.once('exit',(code,signal)=>{
    process.removeListener('SIGINT',stop);
    process.removeListener('SIGTERM',stop);
    if(code) console.error('工作台未能启动。如果端口被占用，请关掉旧窗口，或将 JQQ_WORKBENCH_PORT 改为 4333。');
    process.exitCode=code??(signal==='SIGTERM'?0:1);
  });
}
await main().catch(error=>{
  console.error(error.message);
  process.exitCode=1;
});
