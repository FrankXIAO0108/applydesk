import {getCurrentUser} from '@/lib/auth';
import {database,event} from '@/lib/store';
import {canonicalUrl,matchJob} from '@/lib/domain.mjs';
import {companySchema} from '@/lib/company-schema';
import {z} from 'zod';
export const dynamic='force-dynamic';
const item=z.object({title:z.string().trim().min(1).max(200),url:z.string().url().max(2000),location:z.string().max(200).default(''),employment:z.string().max(100).default(''),description:z.string().max(16000).default('')});
const input=z.object({company:companySchema,state:z.enum(['ready','error','login_required','blocked']),sourceUrl:z.string().url(),error:z.string().max(500).optional(),items:z.array(item).max(100).default([])});
export async function POST(request:Request){
 const user=await getCurrentUser();if(!user)return Response.json({error:'请先登录看板'},{status:401});
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return Response.json({error:'来源校验失败'},{status:403});
 if(!request.headers.get('content-type')?.startsWith('application/json'))return Response.json({error:'需要 JSON 数据'},{status:415});
 try{const raw=await request.text();if(raw.length>1000000)throw new Error('数据过大');const data=input.parse(JSON.parse(raw));data.sourceUrl=canonicalUrl(data.company,data.sourceUrl);if(data.state!=='ready'&&data.items.length)throw new Error('检索失败时不能写入推荐岗位');
 const rows=[...new Map(data.items.map(j=>{const url=canonicalUrl(data.company,j.url);return [url,{...j,url}];})).values()],db=database(),owner=user.userId,now=new Date().toISOString(),stmts:D1PreparedStatement[]=[];
 let matched=0;
 for(const job of rows){const match=matchJob(job),key='url:'+job.url;
 const applied=await db.prepare('SELECT id FROM jobs WHERE owner=? AND company=? AND url=? AND (applied=1 OR appliedAt IS NOT NULL)').bind(owner,data.company,job.url).first();if(applied)continue;
 if(match.state==='matched')matched++;
 stmts.push(db.prepare('INSERT INTO jobs (id,owner,recordKey,company,title,url,location,employment,description,direction,matchState,matchReason,decision,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,\'pending\',?,?) ON CONFLICT(owner,recordKey) DO UPDATE SET title=excluded.title,location=excluded.location,employment=excluded.employment,description=excluded.description,direction=excluded.direction,matchState=excluded.matchState,matchReason=excluded.matchReason,updatedAt=excluded.updatedAt,decision=CASE WHEN excluded.matchState<>\'matched\' AND jobs.decision=\'approved\' THEN \'pending\' ELSE jobs.decision END').bind(crypto.randomUUID(),owner,key,data.company,job.title,job.url,job.location,job.employment,job.description,match.direction,match.state,match.reason,now,now));}
 stmts.push(db.prepare('INSERT INTO searches (id,owner,company,state,sourceUrl,checkedAt,error,itemCount) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(owner,company) DO UPDATE SET state=excluded.state,sourceUrl=excluded.sourceUrl,checkedAt=excluded.checkedAt,error=excluded.error,itemCount=excluded.itemCount').bind(crypto.randomUUID(),owner,data.company,data.state,data.sourceUrl,now,data.error||null,rows.length),event(owner,null,data.state==='ready'?`${data.company}岗位检索：本次读取 ${rows.length} 条，符合条件 ${matched} 条`:`${data.company}岗位检索未完成：${data.error||data.state}`));
 await db.batch(stmts);return Response.json({ok:true,company:data.company,read:rows.length,matched,state:data.state});
 }catch(error){return Response.json({error:error instanceof Error?error.message:'检索结果保存失败'},{status:400});}
}
