import {trackedCompanySchema as companySchema} from '@/lib/company-schema';
import {getCurrentUser} from '@/lib/auth';
import {database,event} from '@/lib/store';
import {canonicalUrl,matchJob,normalizeStage,isFutureApplicationDate} from '@/lib/domain.mjs';
import type {Job} from '@/lib/types';
import {z} from 'zod';
export const dynamic='force-dynamic';
const row=z.object({sourceRecordId:z.string().trim().min(1).max(500),title:z.string().trim().min(1).max(200),url:z.string().url().max(2000),location:z.string().max(200).default(''),employment:z.string().max(100).default(''),description:z.string().max(16000).default(''),applied:z.literal(true).default(true),appliedAt:z.union([z.string().datetime({offset:true}),z.string().date()]).nullable().default(null),rawStatus:z.string().trim().min(1).max(500)});
const input=z.object({company:companySchema,state:z.enum(['connected','partial','login_required','error','blocked']),sourceUrl:z.string().url(),error:z.string().max(500).optional(),records:z.array(row).max(100).default([])});
export async function POST(request:Request){
 const user=await getCurrentUser();if(!user)return Response.json({error:'请先登录看板'},{status:401});
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return Response.json({error:'来源校验失败'},{status:403});
 if(!request.headers.get('content-type')?.startsWith('application/json'))return Response.json({error:'需要 JSON 数据'},{status:415});
 try{
 const raw=await request.text();if(raw.length>1000000)throw new Error('同步数据过大');
 const snapshot=input.parse(JSON.parse(raw));snapshot.sourceUrl=canonicalUrl(snapshot.company,snapshot.sourceUrl);
 if(!['connected','partial'].includes(snapshot.state)&&snapshot.records.length)throw new Error('登录或检查失败时不能更新岗位状态');
 const unique=new Set<string>();for(const item of snapshot.records){item.url=canonicalUrl(snapshot.company,item.url);if(unique.has(item.sourceRecordId))throw new Error('本次快照存在重复记录标识');unique.add(item.sourceRecordId);if(item.appliedAt&&isFutureApplicationDate(item.appliedAt))throw new Error('投递时间不能晚于当前时间');}
 const owner=user.userId,db=database(),now=new Date().toISOString(),statements:D1PreparedStatement[]=[];
 for(const item of snapshot.records){
   const recordKey=`source:${snapshot.company}:${item.sourceRecordId}`;
   const old=await db.prepare('SELECT * FROM jobs WHERE owner=? AND recordKey=?').bind(owner,recordKey).first<Job>();
   const id=old?.id||crypto.randomUUID(),match=matchJob(item),appliedAt=item.appliedAt||old?.appliedAt||null;
   if(old){statements.push(db.prepare('UPDATE jobs SET title=?,url=?,location=?,employment=?,description=?,direction=?,matchState=?,matchReason=?,applied=1,appliedAt=?,rawStatus=?,stage=?,checkedAt=?,checkError=NULL,updatedAt=? WHERE owner=? AND id=?').bind(item.title,item.url,item.location,item.employment,item.description,match.direction,match.state,match.reason,appliedAt,item.rawStatus,normalizeStage(item.rawStatus),now,now,owner,id));if(old.rawStatus!==item.rawStatus)statements.push(event(owner,id,`官网状态更新：${snapshot.company} · ${item.title}：${old.rawStatus||'未注明'} → ${item.rawStatus}`));}
   else statements.push(db.prepare('INSERT INTO jobs (id,owner,recordKey,applied,company,title,url,location,employment,description,direction,matchState,matchReason,decision,appliedAt,rawStatus,stage,checkedAt,createdAt,updatedAt) VALUES (?,?,?,1,?,?,?,?,?,?,?,?,?,\'pending\',?,?,?,?,?,?)').bind(id,owner,recordKey,snapshot.company,item.title,item.url,item.location,item.employment,item.description,match.direction,match.state,match.reason,appliedAt,item.rawStatus,normalizeStage(item.rawStatus),now,now,now),event(owner,id,`官网首次同步：${snapshot.company} · ${item.title} · ${item.rawStatus}`));
 }
 statements.push(db.prepare('INSERT INTO sources (id,owner,company,state,sourceUrl,checkedAt,lastSuccessAt,error,recordCount) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(owner,company) DO UPDATE SET state=excluded.state,sourceUrl=excluded.sourceUrl,checkedAt=excluded.checkedAt,lastSuccessAt=COALESCE(excluded.lastSuccessAt,sources.lastSuccessAt),error=excluded.error,recordCount=CASE WHEN excluded.state IN (\'connected\',\'partial\') THEN excluded.recordCount ELSE sources.recordCount END').bind(crypto.randomUUID(),owner,snapshot.company,snapshot.state,snapshot.sourceUrl,now,snapshot.state==='connected'?now:null,snapshot.error||null,snapshot.records.length));
 if(!['connected','partial'].includes(snapshot.state))statements.push(db.prepare('UPDATE jobs SET checkError=? WHERE owner=? AND company=? AND (applied=1 OR appliedAt IS NOT NULL)').bind(snapshot.error||'官网暂时无法检查',owner,snapshot.company));
 statements.push(event(owner,null,['connected','partial'].includes(snapshot.state)?`${snapshot.company}${snapshot.state==='partial'?'部分读取':'检查完成'}：读取 ${snapshot.records.length} 条投递记录`:`${snapshot.company}检查未完成：${snapshot.error||snapshot.state}`));
 await db.batch(statements);
 return Response.json({ok:true,company:snapshot.company,state:snapshot.state,records:snapshot.records.length,checkedAt:now});
 }catch(error){const message=error instanceof Error?error.message:'同步失败';return Response.json({error:/SQLITE|D1/i.test(message)?'同步失败，请稍后重试':message},{status:400});}
}
