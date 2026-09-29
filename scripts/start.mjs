import {spawn,spawnSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,writeFileSync,openSync,closeSync,unlinkSync,realpathSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import net from 'node:net';
import path from 'node:path';
import {findNpm} from './npm-runtime.mjs';

const root=realpathSync(fileURLToPath(new URL('../',import.meta.url)));
process.chdir(root);
const [major,minor]=process.versions.node.split('.').map(Number);
if(major<22||(major===22&&minor<13))throw new Error('需要 Node.js 22.13+，请让 Codex 使用自带的新版 Node 运行本脚本。');
process.env.PATH=path.dirname(process.execPath)+path.delimiter+(process.env.PATH||'');
mkdirSync('.local',{recursive:true});
const instanceId=createHash('sha256').update(root).digest('hex').slice(0,24);
const version=JSON.parse(readFileSync('package.json','utf8')).version;
const lock='.local/start.lock',stateFile='.local/instance.json';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const alive=pid=>{try{process.kill(pid,0);return true;}catch{return false;}};
let locked=false;
try{
 for(let i=0;i<180&&!locked;i++){
  try{const fd=openSync(lock,'wx');writeFileSync(fd,String(process.pid));closeSync(fd);locked=true;}
  catch(e){if(e.code!=='EEXIST')throw e;let pid=0;try{pid=Number(readFileSync(lock,'utf8'));}catch{}if(pid&&!alive(pid)){try{unlinkSync(lock);}catch{}}else await pause(1000);}
 }
 if(!locked)throw new Error('另一个启动进程仍在安装或初始化，请稍后重试。');
 const run=(args)=>{const r=spawnSync(process.execPath,args,{stdio:['ignore',2,2],windowsHide:true,env:process.env});if(r.error)throw r.error;if(r.status!==0)throw new Error('启动准备未完成，请检查上面的错误并重试。');};
 const fingerprint=createHash('sha256').update(readFileSync('package-lock.json')).update(process.versions.node.split('.')[0]).digest('hex');
 if(!existsSync('node_modules/vinext/dist/cli.js')||!existsSync('.local/dependencies.sha')||readFileSync('.local/dependencies.sha','utf8')!==fingerprint){
  console.error('正在安装依赖（首次启动可能需要几分钟）…');const npm=await findNpm(root);run([npm,'ci','--no-audit','--no-fund','--cache',path.join(root,'.local/npm-cache')]);writeFileSync('.local/dependencies.sha',fingerprint);
 }
 console.error('正在检查本地数据库…');run(['scripts/setup.mjs']);
 const health=async(port)=>{try{const r=await fetch(`http://127.0.0.1:${port}/api/health`,{signal:AbortSignal.timeout(2500)});const d=await r.json();return r.ok&&d.app==='applydesk'&&d.instanceId===instanceId&&d.version===version?d:null;}catch{return null;}};
 let saved={};try{saved=JSON.parse(readFileSync(stateFile,'utf8'));}catch{}
 let port=Number(saved.port)||5173,pid=saved.pid;
 let ready=await health(port);
 if(!ready){
  let selected=0;
  for(const candidate of [...new Set([port,...Array.from({length:30},(_,i)=>5173+i)])]){
   if(await health(candidate)){selected=candidate;ready=true;break;}
   const free=await new Promise(resolve=>{const s=net.createServer();s.once('error',()=>resolve(false));s.listen(candidate,'127.0.0.1',()=>s.close(()=>resolve(true)));});if(free){selected=candidate;break;}
  }
  if(!selected)throw new Error('没有可用的本地端口，请关闭不用的 ApplyDesk 实例后重试。');port=selected;
  if(!ready){
   const log=openSync('.local/server.log','a');
   const child=spawn(process.execPath,['scripts/framework.mjs','dev'],{cwd:root,env:{...process.env,APPLYDESK_PORT:String(port),APPLYDESK_INSTANCE_ID:instanceId},detached:true,windowsHide:true,stdio:['ignore',log,log]});
   child.on('error',e=>console.error(e.message));pid=child.pid;child.unref();closeSync(log);
   for(let attempt=0;attempt<90;attempt++){if(await health(port)){ready=true;break;}if(pid&&!alive(pid))break;await pause(1000);}
   if(!ready)throw new Error('服务未能启动，诊断日志在 .local/server.log；请把错误交给 Codex 检查。');
  }
 }
 const url=`http://127.0.0.1:${port}`;writeFileSync(stateFile,JSON.stringify({app:'applydesk',instanceId,version,port,pid,url},null,2));
 if(process.argv.includes('--open')){
  const cmd=process.platform==='win32'?['rundll32.exe',['url.dll,FileProtocolHandler',url]]:process.platform==='darwin'?['open',[url]]:['xdg-open',[url]];
  const browser=spawn(cmd[0],cmd[1],{windowsHide:true,detached:true,stdio:'ignore'});browser.on('error',()=>console.error(`请手动打开 ${url}`));browser.unref();
 }
 console.log(JSON.stringify({ok:true,app:'applydesk',url,port,instanceId,version}));
}catch(e){console.error('ApplyDesk：'+e.message);process.exitCode=1;}
finally{if(locked)try{unlinkSync(lock);}catch{}}
