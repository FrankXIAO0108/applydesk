import {getCurrentUser} from '@/lib/auth';
import {beginUpdate,finishUpdate,updateStatus} from '@/lib/updates';
import {database} from '@/lib/store';
import {z} from 'zod';
export async function GET(){const u=await getCurrentUser();if(!u)return Response.json({error:'请先登录'},{status:401});return Response.json(await updateStatus(u.userId),{headers:{'Cache-Control':'no-store'}});}
export async function POST(req:Request){const u=await getCurrentUser();if(!u)return Response.json({error:'请先登录'},{status:401});if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'来源校验失败'},{status:403});try{
 const text=await req.text();if(text.length>10000)throw new Error('请求过大');const body=JSON.parse(text);
 if(body.action==='begin'){const input=z.object({triggerKind:z.enum(['manual','scheduled'])}).parse(body);return Response.json(await beginUpdate(u.userId,input.triggerKind));}
 if(body.action==='finish'){const input=z.object({id:z.string().uuid(),error:z.string().max(500).optional()}).parse(body);return Response.json(await finishUpdate(u.userId,input.id,input.error));}
 if(body.action==='register'){const input=z.object({automationId:z.string().min(1).max(150)}).parse(body);await database().prepare('INSERT INTO updateScheduler(owner,automationId,registeredAt) VALUES(?,?,?) ON CONFLICT(owner) DO UPDATE SET automationId=excluded.automationId,registeredAt=excluded.registeredAt').bind(u.userId,input.automationId,new Date().toISOString()).run();return Response.json({ok:true});}
 throw new Error('未知操作');
 }catch(e){return Response.json({error:(e as Error).message},{status:400});}}
