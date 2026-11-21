import { spawn, execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import { constants } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { promisify } from 'node:util';
import { Problem } from './store';

const exec = promisify(execFile);
const codexBundled = '/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex';
const envKeys = ['HOME', 'USER', 'LOGNAME', 'PATH', 'LANG', 'LC_ALL', 'TMPDIR', 'TERM', 'CODEX_HOME'];
const windowsEnvKeys = [
  'SystemRoot', 'WINDIR', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP',
  'HOMEDRIVE', 'HOMEPATH', 'COMSPEC', 'PATHEXT', 'OS', 'ProgramData', 'ProgramFiles',
  'ProgramFiles(x86)', 'CommonProgramFiles', 'USERNAME', 'USERDOMAIN', 'PROCESSOR_ARCHITECTURE',
];

type CodexHost = { platform: NodeJS.Platform; arch: string; env: NodeJS.ProcessEnv };
const currentHost = (): CodexHost => ({ platform: process.platform, arch: process.arch, env: process.env });

function envValue(host: CodexHost, key: string) {
  const exact = host.env[key];
  if (exact !== undefined || host.platform !== 'win32') return exact;
  return Object.entries(host.env).find(([candidate]) => candidate.toUpperCase() === key.toUpperCase())?.[1];
}

export function codexEnvironment(host = currentHost()): NodeJS.ProcessEnv {
  const keys = host.platform === 'win32' ? [...envKeys, ...windowsEnvKeys] : envKeys;
  const env: NodeJS.ProcessEnv = {};
  for (const key of keys) {
    const value = envValue(host, key);
    if (value !== undefined) env[key] = value;
  }
  // Use the same directory for login, image generation, and reading the saved artifact.
  if (env.CODEX_HOME) env.CODEX_HOME = (host.platform === 'win32' ? path.win32 : path.posix).resolve(env.CODEX_HOME);
  return env;
}

export function codexExecutablePaths(host = currentHost()): string[] {
  const windows = host.platform === 'win32';
  const platformPath = windows ? path.win32 : path.posix;
  const absolute = (entry: string) => platformPath.isAbsolute(entry) && (!windows || platformPath.parse(entry).root.length > 1);
  const unquote = (entry: string) => windows ? entry.trim().replace(/^"(.*)"$/, '$1') : entry;

  const override = unquote(envValue(host, 'JQQ_CODEX_EXECUTABLE') ?? '');
  if (override) {
    if (!absolute(override) || (windows && !/\.exe$/i.test(override))) {
      throw new Problem(503, '请将 JQQ_CODEX_EXECUTABLE 设为 Codex 可执行文件的绝对路径。Windows 请指定 .exe 文件。');
    }
    return [override];
  }

  const searchDirs = (envValue(host, 'PATH') ?? '').split(platformPath.delimiter).map(unquote).filter(absolute);
  if (!windows) {
    const bundled = host.platform === 'darwin' ? [codexBundled] : [];
    return [...new Set([...bundled, ...searchDirs.map(directory => platformPath.join(directory, 'codex'))])];
  }

  const localAppData = envValue(host, 'LOCALAPPDATA') ?? '';
  const appData = envValue(host, 'APPDATA') ?? '';
  const installDir = unquote(envValue(host, 'CODEX_INSTALL_DIR') ?? '');
  const standalone = [
    installDir,
    absolute(localAppData) ? platformPath.join(localAppData, 'Programs', 'OpenAI', 'Codex', 'bin') : '',
  ].filter(absolute);
  const npmDirs = absolute(appData) ? [...searchDirs, platformPath.join(appData, 'npm')] : searchDirs;
  const target = host.arch === 'arm64' ? 'aarch64-pc-windows-msvc' : 'x86_64-pc-windows-msvc';
  const platformPackage = host.arch === 'arm64' ? 'codex-win32-arm64' : 'codex-win32-x64';
  // npm installs .cmd launchers on Windows. Find their native binary so user filenames and prompts never reach a shell.
  const npmExecutables = npmDirs.flatMap(directory => {
    const nodeModules = platformPath.basename(directory).toLowerCase() === '.bin'
      ? platformPath.dirname(directory) : platformPath.join(directory, 'node_modules');
    const scope = platformPath.join(nodeModules, '@openai');
    const mainPackage = platformPath.join(scope, 'codex');
    return [platformPath.join(scope, platformPackage), platformPath.join(mainPackage, 'node_modules', '@openai', platformPackage), mainPackage]
      .flatMap(packageDir => ['bin', 'codex'].map(layout => platformPath.join(packageDir, 'vendor', target, layout, 'codex.exe')));
  });
  const binaries = [...searchDirs, ...standalone].map(directory => platformPath.join(directory, 'codex.exe'));
  return [...new Set([...binaries, ...npmExecutables])];
}

async function findCodex() {
  const host = currentHost();
  for (const file of codexExecutablePaths(host)) {
    try {
      await fs.access(file, constants.X_OK);
      if ((await fs.stat(file)).isFile()) return file;
    } catch {
      // Check the other installation locations if this executable is missing.
    }
  }
  if (envValue(host, 'JQQ_CODEX_EXECUTABLE')?.trim()) {
    throw new Problem(503, '找不到 JQQ_CODEX_EXECUTABLE 指定的 Codex。请检查可执行文件路径。');
  }
  throw new Problem(503, '这台电脑还没有可用的 Codex。请安装官方 Codex CLI，再用 ChatGPT 账号登录。');
}

export async function checkCodex() {
  const executable = await findCodex();
  try {
    const {stdout,stderr}=await exec(executable,['login','status'],{env:codexEnvironment(),windowsHide:true,timeout:8000,maxBuffer:10240});
    if(!/Logged in using ChatGPT/i.test(stdout+'\n'+stderr)) throw new Error('wrong_login_mode');
  } catch {
    throw new Problem(503,'请先使用 ChatGPT 账号登录本机 Codex，再生成试戴图。');
  }
  return executable;
}

type Event = {type?:string; thread_id?:string; message?:string; error?:{message?:string};item?:{type?:string;message?:string;text?:string}};
export interface ImageReceipt { path:string; sessionId:string; fileName:string; startedAt:string; finishedAt:string }
function failureHint(details:string) {
  if(/limit|quota|429/i.test(details)) return 'Codex 暂时达到使用上限。可以保留已生成结果，稍后再试。';
  if(/unauth|401|not logged/i.test(details)) return 'Codex 登录暂时不可用。请用 ChatGPT 账号重新登录本机 Codex。';
  if(/windows.{0,80}sandbox|sandbox.{0,80}windows/i.test(details)) return 'Windows 上的 Codex 沙箱暂时不可用。请在终端打开 Codex 并完成本机设置，再回到工作台。';
  if(/no_image_tool|image.+not available/i.test(details)) return '本次 Codex 会话无法使用内置图像工具。';
  return '这张试戴图没有生成可读取的文件。可保留设计方向并重新生成。';
}

export async function codexImage(executable:string, job:{directory:string;input:string[];prompt:string}, signal:AbortSignal):Promise<ImageReceipt> {
  if(signal.aborted) throw new Problem(409,'这轮已停止。');
  const startedAt=new Date();
  const args=['exec','--ignore-user-config','--disable','hooks','--disable','plugins','--enable','image_generation',
    '--ephemeral','--skip-git-repo-check','--sandbox','read-only','--cd',job.directory,
    '-c','approval_policy="never"','-c','web_search="disabled"','--json'];
  for(const filename of job.input) args.push('--image',filename);
  args.push('-');
  const env=codexEnvironment();
  const child=spawn(executable,args,{env,windowsHide:true,stdio:['pipe','pipe','pipe']});
  let thread='', completed=false, failed='', rejected=false, timedOut=false;
  let stderr='';
  child.stderr.on('data',(chunk:Buffer)=>{stderr=(stderr+chunk.toString('utf8')).slice(-7000);});
  child.stdin.on('error',()=>{ /* Child can terminate before reading all input. */ });
  const cancellation=()=>{child.kill('SIGTERM');};
  signal.addEventListener('abort',cancellation,{once:true});
  if(signal.aborted)cancellation();
  const timeout=setTimeout(()=>{timedOut=true;child.kill('SIGTERM');},200000);
  const lines=createInterface({input:child.stdout,crlfDelay:Infinity});
  lines.on('line',raw=>{
    let row:Event;
    try { row=JSON.parse(raw); } catch { return; }
    if(row.type==='thread.started' && /^[0-9a-f-]{36}$/.test(row.thread_id??'')) thread=row.thread_id!;
    if(row.type==='turn.completed') completed=true;
    if(row.type==='turn.failed'||row.type==='error'||row.item?.type==='error')
      failed=(failed+'\n'+(row.message||row.error?.message||row.item?.message||'')).slice(-3000);
    if(row.item?.type==='agent_message'&&/NO_IMAGE_TOOL/.test(row.item.text??'')) rejected=true;
  });
  const closed=new Promise<number|null>((resolve,reject)=>{
    child.once('error',reject);
    child.once('close',resolve);
  });
  child.stdin.end(job.prompt);
  let code:number|null;
  try {code=await closed;}
  catch {throw new Problem(503,'Codex 没有启动，请在终端运行 codex --version 检查安装。');}
  finally{clearTimeout(timeout);signal.removeEventListener('abort',cancellation);lines.close();}
  if(signal.aborted) throw new Problem(409,'这轮已停止。');
  if(timedOut) throw new Problem(504,'这张图等待超时。其余已经保存的图仍可查看。');
  if(code!==0||!completed||!thread||rejected) throw new Problem(502,failureHint(failed+'\n'+stderr+(rejected?' NO_IMAGE_TOOL':'')));
  const generated=await fs.realpath(path.join(env.CODEX_HOME || path.join(homedir(), '.codex'),'generated_images')).catch(()=>null);
  const threadFolder=generated&&await fs.realpath(path.join(generated,thread)).catch(()=>null);
  if(!generated||!threadFolder||path.dirname(threadFolder)!==generated)throw new Problem(502,failureHint(failed+'\n'+stderr));
  const files=await fs.readdir(threadFolder,{withFileTypes:true});
  const real=[];
  for(const entry of files) {
    if(!entry.isFile()||!/^exec-[0-9a-f-]{36}\.(png|jpg|webp)$/.test(entry.name))continue;
    const location=path.join(threadFolder,entry.name);
    const stat=await fs.stat(location);
    if(stat.mtimeMs>=startedAt.valueOf()-1500 && stat.size>4096 && stat.size<=10_000_000) real.push(location);
  }
  if(real.length!==1)throw new Problem(502,real.length?'这次返回了多张图，不能直接配给单个方案。':failureHint(failed+'\n'+stderr));
  return {path:real[0],sessionId:thread,fileName:path.basename(real[0]),startedAt:startedAt.toISOString(),finishedAt:new Date().toISOString()};
}

