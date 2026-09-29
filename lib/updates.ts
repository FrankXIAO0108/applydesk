import {database,event} from './store';
import {getPreferences} from './preferences';
import {feishuConfigured} from './feishu';
import {searchDue} from './cadence.mjs';
export async function updateStatus(owner:string){
 const db=database();await db.prepare("UPDATE updateRuns SET state='failed',finishedAt=?,summary='运行超时；请检查电脑、浏览器连接和登录状态' WHERE owner=? AND state='running' AND startedAt<?").bind(new Date().toISOString(),owner,new Date(Date.now()-90*60000).toISOString()).run();
 const registration=await db.prepare('SELECT automationId,registeredAt FROM updateScheduler WHERE owner=?').bind(owner).first();
 const runs=(await db.prepare('SELECT id,state,startedAt,finishedAt,summary,triggerKind FROM updateRuns WHERE owner=? ORDER BY startedAt DESC LIMIT 15').bind(owner).all()).results;return {registration,runs};
}
export async function beginUpdate(owner:string,triggerKind:'scheduled'|'manual'){
 await updateStatus(owner);const p=await getPreferences(owner),db=database(),now=new Date(),china=new Date(now.getTime()+8*3600000);
 if(!p.updatesEnabled)return {skipped:true,reason:'自动更新已暂停'};
 if(triggerKind==='scheduled'&&([0,6].includes(china.getUTCDay())||china.getUTCHours()<10))return {skipped:true,reason:'未到工作日 10:00'};
 const period=triggerKind==='scheduled'?china.toISOString().slice(0,10):crypto.randomUUID();
 if(await db.prepare("SELECT id FROM updateRuns WHERE owner=? AND (period=? OR state='running')").bind(owner,period).first())return {skipped:true,reason:'本日已执行或另一次更新正在进行'};
 const searchCompanies:string[]=[];
 for(const c of p.companies.filter(c=>c.enabled)){const last=await db.prepare('SELECT checkedAt,state FROM searches WHERE owner=? AND company=?').bind(owner,c.name).first<{checkedAt:string;state:string}>();if(searchDue(last,c.searchEveryDays,now))searchCompanies.push(c.name);}
 const id=crypto.randomUUID();
 try{await db.prepare("INSERT INTO updateRuns(id,owner,period,triggerKind,state,startedAt,config) VALUES(?,?,?,?,'running',?,?)").bind(id,owner,period,triggerKind,now.toISOString(),JSON.stringify({...p,searchCompanies})).run();}catch(e){if(/UNIQUE/i.test(String(e)))return {skipped:true,reason:'已有同一更新任务'};throw e;}
 return {id,preferences:p,searchCompanies,applicationCompanies:p.companies.filter(c=>c.enabled&&c.trackApplications).map(c=>c.name),startedAt:now.toISOString()};
}
export async function finishUpdate(owner:string,id:string,error?:string){
 const db=database(),run=await db.prepare("SELECT startedAt,config FROM updateRuns WHERE id=? AND owner=? AND state='running'").bind(id,owner).first<{startedAt:string;config:string}>();if(!run)throw new Error('更新任务不存在或已经结束');
 const p=JSON.parse(run.config) as Awaited<ReturnType<typeof getPreferences>> & {searchCompanies:string[]},failures:string[]=[];let checked=0;
 for(const company of p.companies.filter(c=>c.enabled)){
  if(p.searchCompanies.includes(company.name)){const search=await db.prepare('SELECT checkedAt,state,error FROM searches WHERE owner=? AND company=?').bind(owner,company.name).first<{checkedAt:string;state:string;error:string}>();
  if(search&&search.checkedAt>=run.startedAt&&search.state==='ready')checked++;else failures.push(company.name+'岗位检索：'+(search&&search.checkedAt>=run.startedAt?(search.error||search.state):'本轮未检查'));}
  if(company.trackApplications){const source=await db.prepare('SELECT checkedAt,state,error FROM sources WHERE owner=? AND company=?').bind(owner,company.name).first<{checkedAt:string;state:string;error:string}>();if(source&&source.checkedAt>=run.startedAt&&source.state==='connected')checked++;else failures.push(company.name+'投递进度：'+(source&&source.checkedAt>=run.startedAt?(source.error||source.state):'本轮未检查'));}
 }
 if(feishuConfigured()){const sheet=await db.prepare('SELECT syncedAt,syncError FROM settings WHERE owner=?').bind(owner).first<{syncedAt:string;syncError:string}>();if(!sheet?.syncedAt||sheet.syncedAt<run.startedAt||sheet.syncError)failures.push('飞书同步未完成');}
 if(error)failures.unshift(error);const state=failures.length?(checked?'partial':'failed'):'success',summary=failures.length?`完成 ${checked} 项；${failures.join('；')}`:`完成 ${checked} 项检查，记录已更新`;
 await db.batch([db.prepare("UPDATE updateRuns SET state=?,finishedAt=?,summary=? WHERE id=? AND owner=? AND state='running'").bind(state,new Date().toISOString(),summary.slice(0,10000),id,owner),event(owner,null,summary.slice(0,10000))]);return {state,summary,checked};
}
