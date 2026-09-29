import {env} from 'cloudflare:workers';
import {getCurrentUser} from '@/lib/auth';
import {database} from '@/lib/store';
import pkg from '@/package.json';
export async function GET(){if(!await getCurrentUser())return Response.json({error:'Local access required'},{status:401});try{await database().prepare('SELECT COUNT(*) AS count FROM jobs').first();return Response.json({app:'applydesk',version:pkg.version,database:true,instanceId:(env as unknown as {APPLYDESK_INSTANCE_ID?:string}).APPLYDESK_INSTANCE_ID||'manual-dev'},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({app:'applydesk',database:false,error:'请重新运行 START.cmd 或 scripts/start.mjs 初始化数据库'},{status:503});}}
