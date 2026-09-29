import {getCurrentUser} from '@/lib/auth';
import {getOnboarding} from '@/lib/onboarding';
import {savePreferences,preferencesSchema} from '@/lib/preferences';
import {database} from '@/lib/store';
export async function GET(){const u=await getCurrentUser();if(!u)return Response.json({error:'请在本机启动工作台'},{status:401});return Response.json(await getOnboarding(u.userId),{headers:{'Cache-Control':'no-store'}});}
export async function POST(req:Request){const u=await getCurrentUser();if(!u)return Response.json({error:'请在本机启动工作台'},{status:401});if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'来源校验失败'},{status:403});if(!req.headers.get('content-type')?.startsWith('application/json'))return Response.json({error:'需要 JSON 数据'},{status:415});try{
 const raw=await req.text();if(raw.length>100000)throw new Error('设置过大');const body=JSON.parse(raw),now=new Date().toISOString();
 if(body.action==='configure'){
  const p=preferencesSchema.parse(body.preferences);if(!p.companies.some(c=>c.enabled))throw new Error('至少选择一家要检索的公司');
  await savePreferences(u.userId,p);await database().prepare('INSERT INTO onboarding(owner,configuredAt) VALUES(?,?) ON CONFLICT(owner) DO UPDATE SET configuredAt=excluded.configuredAt').bind(u.userId,now).run();
 }else if(body.action==='agent-connected'){
  await database().prepare('INSERT INTO onboarding(owner,agentSeenAt) VALUES(?,?) ON CONFLICT(owner) DO UPDATE SET agentSeenAt=excluded.agentSeenAt').bind(u.userId,now).run();
 }else throw new Error('未知操作');
 return Response.json(await getOnboarding(u.userId));
 }catch(e){return Response.json({error:(e as Error).message},{status:400});}}
