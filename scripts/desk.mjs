// Structured local data API for Codex; browser reading still uses the user's browser plugin.
import {readFileSync,realpathSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import path from 'node:path';
const root=realpathSync(fileURLToPath(new URL('../',import.meta.url)));process.chdir(root);
try{
 const state=JSON.parse(readFileSync('.local/instance.json','utf8'));
 const expected=createHash('sha256').update(root).digest('hex').slice(0,24);
 if(state.instanceId!==expected||!Number.isInteger(state.port)||state.port<1024||state.port>65535)throw new Error('实例配置无效，请重新运行 scripts/start.mjs');
 const base=`http://127.0.0.1:${state.port}`;
 const request=async(route,payload)=>{const r=await fetch(base+route,{method:payload?'POST':'GET',headers:{'Content-Type':'application/json','Origin':base},...(payload?{body:JSON.stringify(payload)}:{}),signal:AbortSignal.timeout(route==='/api/desk'&&payload?.action==='sync'?120000:30000)});const body=await r.json();if(!r.ok)throw new Error(body.error||'请求失败');return body;};
 const health=await request('/api/health');if(health.app!=='applydesk'||health.instanceId!==expected)throw new Error('端口不是当前项目实例，已停止写入');
 const [action,...args]=process.argv.slice(2),inputIndex=args.indexOf('--input');
 const input=inputIndex<0?{}:JSON.parse(readFileSync(args[inputIndex+1],'utf8').replace(/^\uFEFF/,''));
 const methods={read:['/api/desk'],probe:['/api/onboarding',{action:'agent-connected'}],preferences:['/api/preferences'],configure:['/api/onboarding',{action:'configure',preferences:input}],settings:['/api/preferences',input],begin:['/api/updates',{...input,action:'begin',triggerKind:input.triggerKind||'manual'}],finish:['/api/updates',{...input,action:'finish'}],register:['/api/updates',{...input,action:'register'}],search:['/api/search',input],source:['/api/source',input],sync:['/api/desk',{action:'sync'}]};
 if(!methods[action])throw new Error('用法：desk.mjs read|probe|preferences|configure|begin|finish|register|search|source|sync [--input JSON文件]');
 console.log(JSON.stringify(await request(...methods[action]),null,2));
}catch(e){console.error('ApplyDesk：'+e.message);process.exitCode=1;}
