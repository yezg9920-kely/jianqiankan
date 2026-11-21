import { randomBytes, timingSafeEqual } from 'node:crypto';
import { createReadStream } from 'node:fs';
import * as fs from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import sharp from 'sharp';
import { analyzeCase, assetFor, attachImage, createCase, getCase, listCases, Problem, promptFor, recommend, reportFor, revise, select, updateFront } from './store';
import { generateNewCase,generateExisting,generateRevision,stopWorkflow } from './workflow';
import { workflowReport } from './workflow-report';

const build = path.resolve(import.meta.dirname,'../dist/workbench');
const configuredPort = process.env.JQQ_WORKBENCH_PORT ?? '4322';
const port = Number(configuredPort);
const token = randomBytes(32).toString('hex');
const bodyLimit = 54_000_000;
const thumbCache = new Map<string,Buffer>();
const CSP = "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";
let authority = '';

function response(res:ServerResponse,status:number,body:unknown) {
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});
  res.end(JSON.stringify(body));
}
function signedIn(req:IncomingMessage) {
  const value = req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('jqq_local='))?.slice('jqq_local='.length);
  return typeof value==='string' && /^[a-f0-9]{64}$/.test(value) && timingSafeEqual(Buffer.from(value),Buffer.from(token));
}
async function jsonBody(req:IncomingMessage) {
  if (!req.headers['content-type']?.toLowerCase().startsWith('application/json')) throw new Problem(415,'请使用工作台提交此操作。');
  if (Number(req.headers['content-length'] ?? 0)>bodyLimit) throw new Problem(413,'这批文件太大，请选更小的照片。');
  const chunks:Buffer[] = [];
  let size=0;
  for await (const chunk of req.iterator({destroyOnReturn:false})) {
    const bytes=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);
    size+=bytes.length;
    if(size>bodyLimit) { req.resume(); throw new Problem(413,'这批文件太大，请选更小的照片。'); }
    chunks.push(bytes);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new Problem(422,'请求内容无法读取，请重新操作。'); }
}
async function stream(req:IncomingMessage,res:ServerResponse,filename:string,type:string) {
  const stat=await fs.stat(filename);
  if(!stat.isFile()) throw new Problem(404,'文件不存在。');
  res.writeHead(200,{'Content-Type':type,'Content-Length':stat.size});
  if(req.method==='HEAD') res.end();
  else await pipeline(createReadStream(filename),res);
}
async function photo(req:IncomingMessage,res:ServerResponse,filename:string,type:string,thumb:boolean) {
  if(!thumb) return stream(req,res,filename,type);
  const stat=await fs.stat(filename);
  const key=filename+';'+stat.size+';'+stat.mtimeMs;
  let contents=thumbCache.get(key);
  if(!contents) {
    contents=await sharp(filename,{limitInputPixels:40_000_000}).rotate().resize(480,680,{fit:'inside',withoutEnlargement:true}).webp({quality:86}).toBuffer();
    if(thumbCache.size>=72) thumbCache.delete(thumbCache.keys().next().value!);
    thumbCache.set(key,contents);
  }
  res.writeHead(200,{'Content-Type':'image/webp','Content-Length':contents.length});
  res.end(req.method==='HEAD'?undefined:contents);
}

if(!Number.isInteger(port)||port<0||port>65535) throw new Error('工作台端口无效。');
await fs.access(path.join(build,'index.html')).catch(()=>{ throw new Error('请先运行 npm run build:workbench。'); });
const listener=createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Security-Policy',CSP);
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('X-Frame-Options','DENY');
  try {
    if(req.headers.host!==authority) throw new Problem(403,'请使用工作台的本机地址。');
    const url=new URL(req.url??'/', 'http://'+authority);
    if(url.host!==authority) throw new Problem(403,'请使用工作台的本机地址。');
    const pathname=url.pathname;
    const method=req.method??'GET', get=method==='GET'||method==='HEAD';
    if(get&&pathname==='/health') {response(res,200,{app:'jianqiankan-workbench',ok:true});return;}
    if(get&&pathname==='/') {
      res.setHeader('Set-Cookie','jqq_local='+token+'; Path=/; HttpOnly; SameSite=Strict');
      await stream(req,res,path.join(build,'index.html'),'text/html; charset=utf-8');
      return;
    }
    if(get&&/^\/assets\/[A-Za-z0-9_-]+\.(js|css|svg)$/.test(pathname)) {
      const type=pathname.endsWith('.js')?'text/javascript; charset=utf-8':pathname.endsWith('.css')?'text/css; charset=utf-8':'image/svg+xml';
      await stream(req,res,path.join(build,pathname),type).catch(err=>{if(!res.headersSent)throw new Problem(404,'页面文件不存在。');throw err;});
      return;
    }
    if(!pathname.startsWith('/api/')) throw new Problem(404,'找不到这个页面。');
    if(!signedIn(req) || (req.headers['sec-fetch-site'] === 'cross-site')) throw new Problem(403,'请从工作台首页重新打开。');
    if(!get&&(method!=='POST'||req.headers.origin!=='http://'+authority||req.headers['x-jqq-action']!=='local'))
      throw new Problem(403,'这个操作只接受工作台页面的请求。');
    if(pathname==='/api/cases/generate'&&!get) { response(res,202,await generateNewCase(await jsonBody(req))); return; }
    if(pathname==='/api/cases') {
      response(res, get?200:201, get?await listCases():await createCase(await jsonBody(req)));
      return;
    }
    const match=pathname.match(/^\/api\/cases\/([A-Za-z0-9_-]{1,100})(?:\/(.*))?$/);
    if(!match) throw new Problem(404,'找不到这个案例。');
    const [,caseId,route='']=match;
    if(get) {
      const liveReport=route.match(/^workflows\/(run-[a-f0-9]{16})\/report$/);
      if(liveReport){
        const report=await workflowReport(caseId,liveReport[1]);
        res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
        res.end(report);return;
      }
      const file=route.match(/^(assets|reports)\/([A-Za-z0-9_-]{1,100})$/);
      if(file) {
        const asset=await (file[1]==='assets'?assetFor(caseId,file[2]):reportFor(caseId,file[2]));
        await photo(req,res,asset.filename,asset.mime,file[1]==='assets'&&url.searchParams.get('thumb')==='1');
      } else if(!route) response(res,200,await getCase(caseId));
      else throw new Problem(404,'这个地址不存在。');
      return;
    }
    const payload=await jsonBody(req);
    const stop=route.match(/^workflows\/(run-[a-f0-9]{16})\/stop$/);
    if(stop){ response(res,200,await stopWorkflow(caseId,stop[1])); return;}
    if(route==='generate'){response(res,202,await generateExisting(caseId,payload));return;}
    if(route==='analyze') response(res,200,await analyzeCase(caseId));
    else if(route==='recommend') response(res,200,await recommend(caseId,payload));
    else if(route==='front') response(res,200,await updateFront(caseId,payload));
    else {
      const plan=route.match(/^plans\/([A-Za-z0-9_-]{1,100})\/(revise|select|prompt|image)$/);
      if(!plan) throw new Problem(404,'这个操作不存在。');
      const [,id,action]=plan;
      if(action==='revise') {
        if(payload?.generate===true) response(res,202,await generateRevision(caseId,id,payload));
        else response(res,201,await revise(caseId,id,payload));
      }
      if(action==='select') response(res,200,await select(caseId,id));
      if(action==='prompt') response(res,201,await promptFor(caseId,id,payload));
      if(action==='image') response(res,200,await attachImage(caseId,id,payload));
    }
  } catch (error) {
    if(res.headersSent||res.destroyed) {if(!res.destroyed)res.destroy();return;}
    if(error instanceof Problem) response(res,error.status,{message:error.message});
    else {
      console.error('本机工作台请求失败:',error instanceof Error?error.name:'Error');
      response(res,500,{message:'这次操作没完成。请刷新重试，或查看本机工作台记录。'});
    }
  }
});
listener.on('error',(error:NodeJS.ErrnoException)=>{
  console.error(error.code==='EADDRINUSE'?'工作台端口正被占用。':'未能启动本机工作台。');
  process.exitCode=1;
});
listener.listen(port,'127.0.0.1',()=>{
  const address=listener.address();
  if(!address||typeof address==='string') throw new Error('未获得本机端口。');
  authority='127.0.0.1:'+address.port;
  console.log('剪前看看工作台已就绪：http://'+authority+'/');
});

