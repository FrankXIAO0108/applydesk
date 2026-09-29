import {getPreferences,configuredUrl,matchPreferences} from '@/lib/preferences';
import {getCurrentUser} from '@/lib/auth';
import {getOnboarding} from '@/lib/onboarding';
import {updateStatus} from '@/lib/updates';
import {database,event} from '@/lib/store';
import {canonicalUrl,matchJob,normalizeStage,nextCheck} from '@/lib/domain.mjs';
import {feishuConfigured,syncFeishu} from '@/lib/feishu';
import type {Job} from '@/lib/types';
import {z} from 'zod';
export const dynamic='force-dynamic';
const reply=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
const jobSchema=z.object({id:z.string().uuid().optional(),company:z.string().trim().min(1).max(80),title:z.string().trim().min(1).max(200),url:z.string().url().max(2000),location:z.string().trim().max(200).default(''),employment:z.string().trim().max(100).default(''),description:z.string().max(16000).default(''),appliedAt:z.string().datetime({offset:true}).nullable().optional(),rawStatus:z.string().trim().max(500).optional()});
async function list(owner:string){return (await database().prepare('SELECT * FROM jobs WHERE owner=? ORDER BY createdAt DESC,id').bind(owner).all<Job>()).results;}
export async function GET(){
 const user=await getCurrentUser();if(!user)return reply({error:'请先登录看板',signIn:'/'},401);
 try{const preferences=await getPreferences(user.userId),updates=await updateStatus(user.userId),onboarding=await getOnboarding(user.userId);const db=database();const [jobs,events,settings,sources,searches]=await Promise.all([list(user.userId),db.prepare('SELECT id,jobId,message,createdAt FROM events WHERE owner=? ORDER BY createdAt DESC LIMIT 100').bind(user.userId).all(),db.prepare('SELECT sheetUrl,syncedAt,syncError FROM settings WHERE owner=?').bind(user.userId).first(),db.prepare('SELECT company,state,checkedAt,lastSuccessAt,error,recordCount FROM sources WHERE owner=?').bind(user.userId).all(),db.prepare('SELECT company,state,sourceUrl,checkedAt,error,itemCount FROM searches WHERE owner=?').bind(user.userId).all()]);return reply({preferences,updates,onboarding,searches:searches.results,sources:sources.results,jobs,events:events.results,feishu:{configured:feishuConfigured(),sheetUrl:null,syncedAt:null,syncError:null,...settings},schedule:{enabled:!!updates.registration&&preferences.updatesEnabled,nextAt:nextCheck(),reason:!preferences.updatesEnabled?'自动更新已暂停':updates.registration?'工作日 10:00，通过本机 Codex 与所选浏览器执行':'尚未绑定自动任务'}});}catch{ return reply({error:'暂时无法读取记录，请稍后刷新'},503);}
}
export async function POST(request:Request){
 const user=await getCurrentUser();if(!user)return reply({error:'请先登录看板'},401);
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return reply({error:'来源校验失败'},403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return reply({error:'需要 JSON 数据'},415);
 if(Number(request.headers.get('content-length'))>1000000)return reply({error:'导入数据过大'},413);
 try{
 const raw=await request.text();if(raw.length>1000000)return reply({error:'导入数据过大'},413);
 const body=JSON.parse(raw);const preferences=await getPreferences(user.userId);const db=database(),owner=user.userId,now=new Date().toISOString();
 if(body.action==='import'){
   const parsed=z.array(jobSchema).min(1).max(100).parse(body.jobs).map(item=>({...item,url:configuredUrl(preferences,item.company,item.url,true)}));
   const items=[...new Map(parsed.map(item=>[item.url,item])).values()];
   for(const item of items){if(item.rawStatus&&!item.appliedAt&&!item.id)throw new Error('填写投递状态时需要提供实际投递时间');if(item.appliedAt&&new Date(item.appliedAt)>new Date())throw new Error('实际投递时间不能晚于现在');}
   const statements:D1PreparedStatement[]=[];
   let count=0;
   for(const item of items){
     const previous=item.id?await db.prepare('SELECT * FROM jobs WHERE owner=? AND id=?').bind(owner,item.id).first<Job>():await db.prepare('SELECT * FROM jobs WHERE owner=? AND (recordKey=? OR (recordKey IS NULL AND url=?))').bind(owner,'url:'+item.url,item.url).first<Job>();
     const match=matchPreferences(item,preferences);const id=previous?.id||crypto.randomUUID();
     if(previous){
       statements.push(db.prepare('UPDATE jobs SET title=?,location=?,employment=?,description=?,direction=?,matchState=?,matchReason=?,updatedAt=?,decision=CASE WHEN ?<>\'matched\' AND decision=\'approved\' AND applied=0 AND appliedAt IS NULL THEN \'pending\' ELSE decision END WHERE id=? AND owner=?').bind(item.title,item.location,item.employment,item.description,match.direction,match.state,match.reason,now,match.state,id,owner),event(owner,id,`更新岗位资料：${item.company} · ${item.title}`));
     }else{
       if(item.rawStatus&&!item.appliedAt)throw new Error('填写投递状态时需要提供实际投递时间');
       statements.push(db.prepare('INSERT INTO jobs (id,owner,recordKey,company,title,url,location,employment,description,direction,matchState,matchReason,decision,appliedAt,rawStatus,stage,checkedAt,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,owner,'url:'+item.url,item.company,item.title,item.url,item.location,item.employment,item.description,match.direction,match.state,match.reason,'pending',item.appliedAt||null,item.rawStatus||null,item.appliedAt?normalizeStage(item.rawStatus||'已投递'):null,item.appliedAt&&item.rawStatus?now:null,now,now),event(owner,id,`${item.appliedAt?'录入投递记录':'收录岗位'}：${item.company} · ${item.title}`));
     }count++;
   }await db.batch(statements);return reply({count});
 }
 if(body.action==='decide'){
   const input=z.object({id:z.string().uuid(),decision:z.enum(['approved','ignored','pending'])}).parse(body);
   const result=await db.batch([db.prepare('UPDATE jobs SET decision=?,updatedAt=? WHERE id=? AND owner=? AND applied=0 AND appliedAt IS NULL AND (matchState=\'matched\' OR ?<>\'approved\') AND decision<>?').bind(input.decision,now,input.id,owner,input.decision,input.decision),db.prepare('INSERT INTO events (id,owner,jobId,message,createdAt) SELECT ?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),owner,input.id,{approved:'确认要投；等待简历匹配与官网提交',ignored:'标记为不考虑',pending:'撤回决定，恢复待确认'}[input.decision],now)]);
   if(result[0].meta.changes!==1)return reply({error:'记录已变化，或岗位尚未满足筛选条件，请刷新后再试'},409);
   return reply({ok:true});
 }
 if(body.action==='observe'){
   const input=z.object({id:z.string().uuid(),rawStatus:z.string().trim().max(500).optional(),checkError:z.string().trim().max(500).optional(),appliedAt:z.string().datetime({offset:true}).optional()}).parse(body);
   if(!input.rawStatus&&!input.checkError)throw new Error('请提供官网状态原文或检查异常');
   const previous=await db.prepare('SELECT * FROM jobs WHERE id=? AND owner=?').bind(input.id,owner).first<Job>();if(!previous)return reply({error:'记录不存在'},404);
   if(input.checkError){await db.batch([db.prepare('UPDATE jobs SET checkError=?,updatedAt=? WHERE id=? AND owner=?').bind(input.checkError,now,input.id,owner),event(owner,input.id,`检查异常，保留原状态：${input.checkError}`)]);}
   else{
     const appliedAt=previous.appliedAt||input.appliedAt||null;if(!appliedAt&&!previous.applied)throw new Error('请填写实际投递时间；确认岗位不等于投递成功');if(appliedAt&&new Date(appliedAt)>new Date())throw new Error('实际投递时间不能晚于现在');
     await db.batch([db.prepare('UPDATE jobs SET applied=1,rawStatus=?,stage=?,appliedAt=?,checkedAt=?,checkError=NULL,updatedAt=? WHERE id=? AND owner=?').bind(input.rawStatus,normalizeStage(input.rawStatus!),appliedAt,now,now,input.id,owner),event(owner,input.id,`手动核对官网：${previous.rawStatus||'未记录'} → ${input.rawStatus}`)]);
   }return reply({ok:true});
 }
 if(body.action==='sync'){if(!feishuConfigured())return reply({error:'飞书尚未授权接入；请先配置应用凭据'},409);const result=await syncFeishu(owner,await list(owner));await event(owner,null,`飞书同步完成：${result.count} 条记录`).run();return reply(result);}
 return reply({error:'不支持的操作'},400);
 }catch(error){if(error instanceof z.ZodError)return reply({error:'请检查字段格式：'+error.issues.map(i=>i.path.join('.')+' '+i.message).join('；')},400);if(error instanceof SyntaxError)return reply({error:'JSON 格式有误'},400);const message=error instanceof Error?error.message:'保存失败';return reply({error:/D1|SQLITE|database/i.test(message)?'保存失败，请刷新后重试':message},400);}
}
