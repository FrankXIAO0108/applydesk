import {env} from 'cloudflare:workers';
import {database} from './store';
import {safeCell,hasApplied} from './domain.mjs';
import type {Job} from './types';
import {feishuRequest as call} from './feishu-http.mjs';
type FeishuEnv={FEISHU_APP_ID?:string;FEISHU_APP_SECRET?:string;FEISHU_FOLDER_TOKEN?:string};
export function feishuConfigured(){const e=env as FeishuEnv;return !!(e.FEISHU_APP_ID&&e.FEISHU_APP_SECRET);}
export async function syncFeishu(owner:string,jobs:Job[]){
 if(!feishuConfigured())throw new Error('飞书尚未授权接入');
 const db=database(), e=env as FeishuEnv, now=new Date().toISOString();
 await db.prepare('INSERT INTO settings (owner) VALUES (?) ON CONFLICT(owner) DO NOTHING').bind(owner).run();
 const lock=await db.prepare('UPDATE settings SET syncLock=? WHERE owner=? AND (syncLock IS NULL OR syncLock<?)').bind(now,owner,new Date(Date.now()-600000).toISOString()).run();
 if(lock.meta.changes!==1)throw new Error('已有飞书同步正在运行，请稍后刷新');
 try{
 const auth=await call('auth/v3/tenant_access_token/internal','POST',{app_id:e.FEISHU_APP_ID,app_secret:e.FEISHU_APP_SECRET});
 if(!auth.tenant_access_token)throw new Error('飞书未返回有效凭据');
 const token=auth.tenant_access_token;
 let config=await db.prepare('SELECT sheetToken,sheetId,sheetUrl FROM settings WHERE owner=?').bind(owner).first<{sheetToken:string|null;sheetId:string|null;sheetUrl:string|null}>();
 if(!config?.sheetToken){
   const created=await call('sheets/v3/spreadsheets','POST',{title:'北京实习投递记录',...(e.FEISHU_FOLDER_TOKEN?{folder_token:e.FEISHU_FOLDER_TOKEN}:{})},token);
   const sheet=created.data?.spreadsheet;
   if(!sheet?.spreadsheet_token)throw new Error('飞书没有返回表格编号');
   await db.prepare('UPDATE settings SET sheetToken=?,sheetUrl=? WHERE owner=?').bind(sheet.spreadsheet_token,sheet.url,owner).run();
   config={sheetToken:sheet.spreadsheet_token,sheetUrl:sheet.url,sheetId:null};
 }
 if(!config.sheetId){
   const list=await call(`sheets/v3/spreadsheets/${encodeURIComponent(config.sheetToken!)}/sheets/query`,'GET',null,token);
   const sheet=list.data?.sheets?.[0];
   if(!sheet?.sheet_id)throw new Error('飞书表格中没有可写入的工作表');
   config.sheetId=sheet.sheet_id;
   await db.prepare('UPDATE settings SET sheetId=? WHERE owner=?').bind(config.sheetId,owner).run();
 }
 const rows=[['记录编号','公司','岗位','地点','实习类型','方向','决定','投递时间','官网原始状态','归类状态','最近检查','检查异常','岗位链接'],...jobs.map(j=>[j.id,j.company,j.title,j.location,j.employment,j.direction,hasApplied(j)?'已投递':({pending:'待确认',approved:'已确认，待投递',ignored:'不考虑'}[j.decision]||j.decision),j.appliedAt||(hasApplied(j)?'官网未注明':''),j.rawStatus||'',j.stage||'',j.checkedAt||'',j.checkError||'',j.url].map(safeCell))];
 // Owns a dedicated sheet. Rows are never deleted locally; rewriting in a stable
 // order makes retries idempotent, including after a timeout or partial batch.
 for(let i=0;i<rows.length;i+=500){const values=rows.slice(i,i+500);await call(`sheets/v2/spreadsheets/${encodeURIComponent(config.sheetToken!)}/values`,'PUT',{valueRange:{range:`${config.sheetId}!A${i+1}:M${i+values.length}`,values}},token);}
 await db.prepare('UPDATE settings SET syncedAt=?,syncError=NULL WHERE owner=?').bind(new Date().toISOString(),owner).run();
 return {url:config.sheetUrl,count:jobs.length};
 }catch(error){await db.prepare('UPDATE settings SET syncError=? WHERE owner=?').bind(error instanceof Error?error.message:'飞书同步失败',owner).run();throw error;}
 finally{await db.prepare('UPDATE settings SET syncLock=NULL WHERE owner=? AND syncLock=?').bind(owner,now).run();}
}
