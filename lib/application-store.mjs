import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readFileSync,writeFileSync,realpathSync,statSync} from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {COMPANIES} from './domain.mjs';

const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const required=(value,name,max=2000)=>{if(typeof value!=='string'||!value.trim()||value.length>max)throw new Error(name+'无效');return value.trim();};
export const jobFingerprint=j=>digest(JSON.stringify([j.id,j.company,j.title,j.url,j.location,j.employment,j.description]));
export class ApplicationStore {
 constructor(root,{getDesk,markApplied,now=()=>new Date()}={}){
  this.root=realpathSync(root);this.now=now;this.getDesk=getDesk;this.markApplied=markApplied;
  this.privateDir=path.join(this.root,'.local');for(const dir of ['resumes','evidence','receipts'])mkdirSync(path.join(this.privateDir,dir),{recursive:true,mode:0o700});
  this.db=new DatabaseSync(path.join(this.privateDir,'applications.sqlite'));
  this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
   CREATE TABLE IF NOT EXISTS resumes(id TEXT PRIMARY KEY,label TEXT NOT NULL,fileName TEXT NOT NULL,path TEXT NOT NULL,sha256 TEXT NOT NULL,size INTEGER NOT NULL,directions TEXT NOT NULL,createdAt TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS applications(id TEXT PRIMARY KEY,jobId TEXT NOT NULL,resumeId TEXT NOT NULL,state TEXT NOT NULL,token TEXT,expiresAt TEXT,payload TEXT NOT NULL,updatedAt TEXT NOT NULL);
   CREATE UNIQUE INDEX IF NOT EXISTS one_application_per_job ON applications(jobId) WHERE state <> 'cancelled';`);
 }
 close(){this.db.close();}
 register(bytes,fileName,label,directions=[]){
  const ext=path.extname(fileName||'').toLowerCase();if(!['.pdf','.docx'].includes(ext))throw new Error('只支持 PDF 或 DOCX 简历');
  if(!bytes.length||bytes.length>8*1024*1024)throw new Error('简历必须为 1 字节至 8 MB');
  if(ext==='.pdf'&&!bytes.subarray(0,1024).includes(Buffer.from('%PDF-')))throw new Error('不是有效的 PDF 文件');
  if(ext==='.docx'&&bytes.subarray(0,2).toString()!=='PK')throw new Error('不是有效的 DOCX 文件');
  if(!Array.isArray(directions)||directions.some(d=>typeof d!=='string'||d.length>60)||directions.length>10)throw new Error('简历方向无效');
  const id=randomUUID(),file=path.join(this.privateDir,'resumes',id+ext),name=path.basename(fileName.replaceAll('\\','/')).slice(0,180),sha=digest(bytes);
  writeFileSync(file,bytes,{flag:'wx',mode:0o600});
  this.db.prepare('INSERT INTO resumes VALUES(?,?,?,?,?,?,?,?)').run(id,required(label||name,'简历名称',100),name,file,sha,bytes.length,JSON.stringify(directions),this.now().toISOString());return this.resume(id);
 }
 registerPath(input){const file=realpathSync(required(input.path,'简历路径'));if(!statSync(file).isFile())throw new Error('简历路径不是文件');if(statSync(file).size>8*1024*1024)throw new Error('简历超过 8 MB');return this.register(readFileSync(file),path.basename(file),input.label,input.directions||[]);}
 resume(id,includePath=false){const r=this.db.prepare('SELECT * FROM resumes WHERE id=?').get(id);if(!r)throw new Error('简历不存在');const result={...r,directions:JSON.parse(r.directions)};if(!includePath)delete result.path;return result;}
 verifyResume(id){const r=this.resume(id,true);if(digest(readFileSync(r.path))!==r.sha256)throw new Error('简历副本发生变化，必须重新登记并确认');return r;}
 expire(){this.db.prepare("UPDATE applications SET state=CASE WHEN state='submitting' THEN 'unknown' ELSE 'needs_input' END,token=NULL,expiresAt=NULL,updatedAt=? WHERE state IN ('filling','submitting') AND expiresAt<?").run(this.now().toISOString(),this.now().toISOString());}
 task(id){this.expire();const r=this.db.prepare('SELECT * FROM applications WHERE id=?').get(id);if(!r)throw new Error('投递任务不存在');return {...JSON.parse(r.payload),id:r.id,jobId:r.jobId,resumeId:r.resumeId,state:r.state,updatedAt:r.updatedAt};}
 list(){this.expire();return {resumes:this.db.prepare('SELECT id FROM resumes ORDER BY createdAt DESC').all().map(r=>this.resume(r.id)),tasks:this.db.prepare('SELECT id FROM applications ORDER BY updatedAt DESC').all().map(r=>this.task(r.id))};}
 async context(jobId){const desk=await this.getDesk(),job=desk.jobs.find(j=>j.id===jobId);if(!job)throw new Error('岗位不存在');const company=desk.preferences.companies.find(c=>c.name===job.company&&c.enabled);if(!company)throw new Error('公司已停用或移除');return {job,company,browser:desk.preferences.browser||'auto'};}
 approvedUrl(url,company){const u=new URL(required(url,'官网链接')),preset=COMPANIES.find(c=>c.name===company.name),entries=[company.url,company.applicationUrl].filter(Boolean).map(s=>new URL(s));const hosts=new Set([...(preset?.hosts||[]),...entries.map(u=>u.hostname)]);
  if(u.protocol!=='https:'||u.username||u.password||u.port||!hosts.has(u.hostname))throw new Error('投递或回执链接不属于已确认的招聘方');
  const restrictions=preset?.restrictedPaths?.[u.hostname];if(restrictions&&!restrictions.some(p=>u.pathname===p||u.pathname.startsWith(p.endsWith('/')?p:p+'/')))throw new Error('共享招聘平台的公司路径不匹配');
  if(!preset&&/mokahr\.com$|feishu\.cn$/.test(u.hostname)&&!entries.some(e=>e.hostname===u.hostname&&(u.pathname===e.pathname||u.pathname.startsWith(e.pathname.replace(/\/$/,'')+'/'))))throw new Error('共享招聘平台路径不匹配');return u.toString();
 }
 async enqueue({jobId,resumeId,confirmed}){
  if(confirmed!==true)throw new Error('需要确认向该岗位招聘方发送所选简历并提交申请');
  const {job,company,browser}=await this.context(jobId);if(job.applied||job.appliedAt)throw new Error('该岗位已有投递记录，不能重复提交');
  if(job.decision!=='approved'||job.matchState!=='matched')throw new Error('请先核对岗位并确认要投');
  this.approvedUrl(job.url,company);const resume=this.verifyResume(resumeId),existing=this.db.prepare("SELECT id,resumeId FROM applications WHERE jobId=? AND state<>'cancelled'").get(jobId);
  if(existing){if(existing.resumeId!==resumeId)throw new Error('该岗位已有其他简历的任务；先取消未提交任务再重新确认');return this.task(existing.id);}
  const id=randomUUID(),payload={job:{...job},company,browser,resumeName:resume.label,resumeSha256:resume.sha256,jobHash:jobFingerprint(job),authorizedAt:this.now().toISOString(),authorization:'已确认向此岗位招聘方发送指定简历并提交申请',reason:null,receipt:null};
  try{this.db.prepare("INSERT INTO applications VALUES(?,?,?,'queued',NULL,NULL,?,?)").run(id,jobId,resumeId,JSON.stringify(payload),this.now().toISOString());}catch(e){const duplicate=this.db.prepare("SELECT id,resumeId FROM applications WHERE jobId=? AND state<>'cancelled'").get(jobId);if(duplicate&&duplicate.resumeId===resumeId)return this.task(duplicate.id);throw e;}
  return this.task(id);
 }
 async validate(task){const {job,company}=await this.context(task.jobId);if(job.applied||job.appliedAt)throw new Error('官网投递记录已存在，请核对后回填，不要重复投递');if(job.decision!=='approved'||job.matchState!=='matched'||jobFingerprint(job)!==task.jobHash)throw new Error('岗位或决定已变化，需取消任务并重新确认');const r=this.verifyResume(task.resumeId);if(r.sha256!==task.resumeSha256)throw new Error('简历版本发生变化');return {job,company,resume:r};}
 async claim(id){const task=this.task(id);if(!['queued','needs_input'].includes(task.state))throw new Error('任务不可重复领取；结果不明时先核实官网');const context=await this.validate(task),token=randomUUID();const r=this.db.prepare("UPDATE applications SET state='filling',token=?,expiresAt=?,updatedAt=? WHERE id=? AND state IN ('queued','needs_input')").run(token,new Date(this.now().getTime()+60*60000).toISOString(),this.now().toISOString(),id);if(!r.changes)throw new Error('已有执行器领取任务');return {...this.task(id),token,resume:context.resume,evidenceDirectory:path.join(this.privateDir,'evidence')};}
 lease(id,token,states){this.expire();const row=this.db.prepare('SELECT * FROM applications WHERE id=?').get(id);if(!row||!token||row.token!==token||!states.includes(row.state))throw new Error('任务状态或执行令牌无效；不要继续官网提交');return row;}
 async prepare({id,token,formUrl,reviewSummary}){this.lease(id,token,['filling']);const task=this.task(id),{company}=await this.validate(task);const data={...task,formUrl:this.approvedUrl(formUrl,company),reviewSummary:required(reviewSummary,'填写核对说明',2000),preparedAt:this.now().toISOString()};const r=this.db.prepare("UPDATE applications SET state='submitting',payload=?,updatedAt=? WHERE id=? AND token=? AND state='filling'").run(JSON.stringify(data),this.now().toISOString(),id,token);if(!r.changes)throw new Error('任务已取消或变化，停止提交');return this.task(id);}
 pause({id,token,reason}){const row=this.lease(id,token,['filling','submitting']),task=this.task(id);task.reason=required(reason,'待处理原因',1000);const state=row.state==='submitting'?'unknown':'needs_input';this.db.prepare('UPDATE applications SET state=?,token=NULL,expiresAt=NULL,payload=?,updatedAt=? WHERE id=? AND token=?').run(state,JSON.stringify(task),this.now().toISOString(),id,token);return this.task(id);}
 cancel(id){const r=this.db.prepare("UPDATE applications SET state='cancelled',token=NULL,expiresAt=NULL,updatedAt=? WHERE id=? AND state IN ('queued','filling','needs_input')").run(this.now().toISOString(),id);if(!r.changes)throw new Error('已进入提交阶段，先核实官网结果，不能当作未投递取消');return this.task(id);}
 async complete({id,token,reconcile=false,receiptUrl,receiptText,evidencePath}){
  const task=this.task(id);if(task.state==='submitted')return task;if(task.state==='verified')return this.sync(id);if(!(reconcile===true&&task.state==='unknown'))this.lease(id,token,['submitting']);
  const text=required(receiptText,'官网回执原文',2000);if(/失败|未成功|未投递|未申请|未提交|尚未|not\s+(?:submitted|applied|received)|unsuccessful|failed|[?？]/i.test(text))throw new Error('回执含失败或不确定说明，请保留结果待核实');if(!/投递成功|申请成功|已投递|已申请|简历.{0,5}(筛选|收到)|application.{0,20}(submitted|received)|successfully.{0,15}(applied|submitted)/i.test(text))throw new Error('没有明确的成功回执，请标记结果待核实');
  const url=this.approvedUrl(receiptUrl,task.company),file=realpathSync(required(evidencePath,'回执截图路径'));
  const base=realpathSync(path.join(this.privateDir,'evidence'));if(!file.startsWith(base+path.sep)||!['.png','.jpg','.jpeg'].includes(path.extname(file).toLowerCase())||statSync(file).size>12*1024*1024)throw new Error('截图必须是当前实例 .local/evidence 内的 PNG/JPEG 文件');
  const bytes=readFileSync(file);if(!(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||(bytes[0]===255&&bytes[1]===216)))throw new Error('回执证据不是有效图片');
  const saved=path.join(this.privateDir,'receipts',id+'-'+randomUUID()+path.extname(file));writeFileSync(saved,bytes,{flag:'wx',mode:0o600});
  task.receipt={url,text,evidencePath:saved,sha256:digest(bytes),observedAt:this.now().toISOString()};task.reason=null;
  const expected=task.state;const result=this.db.prepare('UPDATE applications SET state=\'verified\',token=NULL,expiresAt=NULL,payload=?,updatedAt=? WHERE id=? AND state=?').run(JSON.stringify(task),this.now().toISOString(),id,expected);if(!result.changes)throw new Error('任务状态已变化，回执未写入');return this.sync(id);
 }
 async sync(id){const task=this.task(id);if(task.state==='submitted')return task;if(task.state!=='verified'||!task.receipt)throw new Error('还没有已核验的回执');try{await this.markApplied(task.jobId,{rawStatus:'已投递',appliedAt:task.receipt.observedAt});}catch{throw new Error('官网回执已保存，记录同步失败；请只重试同步，勿重复投递');}this.db.prepare("UPDATE applications SET state='submitted',updatedAt=? WHERE id=? AND state='verified'").run(this.now().toISOString(),id);return this.task(id);}
}
