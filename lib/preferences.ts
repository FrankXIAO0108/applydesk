import {z} from 'zod';
import {COMPANIES,TRACKED_COMPANIES,matchJob,DIRECTION_PATTERNS} from './domain.mjs';
import {database,event} from './store';
export const DIRECTIONS=['大模型应用算法','Agent','业务算法','后训练'];
const words=z.array(z.string().trim().min(1).max(60)).max(30);
export function publicUrl(value:string){
 const u=new URL(value),h=u.hostname;
 if(u.protocol!=='https:'||u.username||u.password||u.port||!h.includes('.')||/^(?:\d|\[)|(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(h))throw new Error('请填写不带登录凭据的 HTTPS 公网招聘链接');
 return u;
}
const company=z.object({name:z.string().trim().min(1).max(80),url:z.string().max(2000),applicationUrl:z.string().max(2000).default(''),enabled:z.boolean(),trackApplications:z.boolean(),searchEveryDays:z.union([z.literal(7),z.literal(14)]).default(7)}).superRefine((c,ctx)=>{try{publicUrl(c.url);if(c.applicationUrl)publicUrl(c.applicationUrl);}catch(e){ctx.addIssue({code:'custom',message:(e as Error).message});}});
export const preferencesSchema=z.object({cities:words.min(1),employment:z.enum(['日常实习','全部实习']),directions:z.array(z.enum(['大模型应用算法','Agent','业务算法','后训练'])).min(1).max(4),includeKeywords:words,excludeKeywords:words,companies:z.array(company).min(1).max(60),updatesEnabled:z.boolean()}).superRefine((p,ctx)=>{if(new Set(p.companies.map(c=>c.name)).size!==p.companies.length)ctx.addIssue({code:'custom',message:'公司名称不能重复'});});
export type Preferences=z.infer<typeof preferencesSchema>;
export function defaults():Preferences{return {cities:['北京'],employment:'日常实习',directions:[...DIRECTIONS] as Preferences['directions'],includeKeywords:[],excludeKeywords:[],updatesEnabled:false,companies:COMPANIES.map(c=>({name:c.name,url:c.url,applicationUrl:'',enabled:false,trackApplications:false,searchEveryDays:7}))};}
export async function getPreferences(owner:string){const row=await database().prepare('SELECT value FROM preferences WHERE owner=?').bind(owner).first<{value:string}>();return row?preferencesSchema.parse(JSON.parse(row.value)):defaults();}
export function configuredUrl(p:Preferences,name:string,value:string,allowDisabled=false){
 const company=p.companies.find(c=>c.name===name);if(!company||(!company.enabled&&!allowDisabled))throw new Error('公司不存在或已停用');
 const u=publicUrl(value),preset=COMPANIES.find(c=>c.name===name),configured=[company.url,company.applicationUrl].filter(Boolean).map(publicUrl);
 const hosts=new Set([...(preset?.hosts||[]),...configured.map(u=>u.hostname)]);if(!hosts.has(u.hostname))throw new Error('链接域名与该公司配置不一致');
 const restrictions=(preset?.restrictedPaths as Record<string,string[]>|undefined)?.[u.hostname];
 if(restrictions&&!restrictions.some(p=>u.pathname===p||u.pathname.startsWith(p.endsWith('/')?p:p+'/')))throw new Error('招聘平台路径不属于该公司');
 if(!preset&&/mokahr\.com$|feishu\.cn$/.test(u.hostname)&&!configured.some(c=>c.hostname===u.hostname&&(u.pathname===c.pathname||u.pathname.startsWith(c.pathname.replace(/\/$/,'')+'/'))))throw new Error('共享招聘平台路径不属于该公司');
 for(const k of [...u.searchParams.keys()])if(/^(utm_|spm$|from$)/.test(k))u.searchParams.delete(k);u.searchParams.sort();return u.toString();
}
export function matchPreferences(job:{title:string;description:string;location:string;employment:string;company?:string},p:Preferences){
 const text=(job.title+'\n'+job.description).toLowerCase();
 const base=matchJob({...job,location:'北京',employment:p.employment==='全部实习'&&/实习|intern/i.test(job.employment)?'日常实习':job.employment});
 const selected=String(DIRECTION_PATTERNS.find(([name,pattern])=>p.directions.includes(name as Preferences['directions'][number])&&(pattern as RegExp).test(text))?.[0]||'');
 const result=(state:string,reason:string)=>({state,reason,direction:selected||base.direction});
 if(job.company&&!p.companies.some(c=>c.name===job.company&&c.enabled))return result('excluded','公司已停用或移除');
 if(p.excludeKeywords.some(w=>text.includes(w.toLowerCase())))return result('excluded','命中排除关键词');
 if(!job.location.trim())return result('review','工作地点未注明');
 if(!p.cities.some(c=>job.location.toLowerCase().includes(c.toLowerCase())||(c==='北京'&&/beijing/i.test(job.location))))return result('excluded','工作地点不符合设置');
 if(p.employment==='全部实习'&&!/实习|intern/i.test(job.employment))return result(job.employment?'excluded':'review','尚未确认是实习岗位');
 if(base.state!=='matched')return base;
 if(!selected)return result('excluded','岗位方向不在已选范围');
 if(p.includeKeywords.length&&!p.includeKeywords.some(w=>text.includes(w.toLowerCase())))return result('excluded','未命中包含关键词');
 return result('matched',`${job.location} · ${job.employment} · ${selected}`);
}
export async function savePreferences(owner:string,input:unknown){
 const p=preferencesSchema.parse(input),db=database(),now=new Date().toISOString();
 const jobs=(await db.prepare('SELECT id,title,description,location,employment,company FROM jobs WHERE owner=? AND applied=0 AND appliedAt IS NULL').bind(owner).all<{id:string;title:string;description:string;location:string;employment:string;company:string}>()).results;
 await db.batch([db.prepare('INSERT INTO preferences(owner,value,updatedAt) VALUES(?,?,?) ON CONFLICT(owner) DO UPDATE SET value=excluded.value,updatedAt=excluded.updatedAt').bind(owner,JSON.stringify(p),now),...jobs.map(j=>{const m=matchPreferences(j,p);return db.prepare("UPDATE jobs SET direction=?,matchState=?,matchReason=?,updatedAt=?,decision=CASE WHEN ?<>'matched' AND decision='approved' THEN 'pending' ELSE decision END WHERE owner=? AND id=?").bind(m.direction,m.state,m.reason,now,m.state,owner,j.id);}),event(owner,null,'已保存筛选与公司设置，重新筛选候选岗位')]);return p;
}
