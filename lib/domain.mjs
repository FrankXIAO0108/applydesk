export const DIRECTION_PATTERNS=[['后训练',/后训练|post[ -]?train|RLHF|RLVR|GRPO|DPO|SFT|奖励模型|对齐|强化学习/i],['Agent',/\bagent\b|智能体|多智能体/i],['大模型应用算法',/大模型|LLM|RAG|检索增强|生成式|AIGC/i],['业务算法',/推荐|广告|搜索|排序|召回|策略算法|风控算法|业务算法|机器学习|数据挖掘|自然语言|对话系统|NLP/i]];
// Example configuration. Change this list to the companies you personally track.
export const TRACKED_COMPANIES = ['快手','美团','阿里巴巴','京东','滴滴','百度','字节跳动'];
export const COMPANIES = [
 {name:'美团',letter:'美',color:'#fff2bf',url:'https://zhaopin.meituan.com/web/campus',hosts:['zhaopin.meituan.com','job.meituan.com','career.meituan.com']},
 {name:'百度',letter:'百',color:'#e5edff',url:'https://talent.baidu.com/jobs/',hosts:['talent.baidu.com']},
 {name:'京东',letter:'京',color:'#ffe8e8',url:'https://campus.jd.com/',hosts:['campus.jd.com','zhaopin.jd.com']},
 {name:'快手',letter:'快',color:'#ffede0',url:'https://zhaopin.kuaishou.cn/',hosts:['zhaopin.kuaishou.cn']},
 {name:'字节跳动',letter:'字',color:'#e1f1ff',url:'https://jobs.bytedance.com/campus/',hosts:['jobs.bytedance.com']},
 {name:'阿里巴巴',letter:'阿',color:'#fff0db',url:'https://campus-talent.alibaba.com/campus/index',hosts:['campus-talent.alibaba.com','talent.alibaba.com']},
 {name:'滴滴',letter:'滴',color:'#fff0db',url:'https://app.mokahr.com/social-recruitment/didiglobal/6222?locale=zh-CN#/jobs',hosts:['campus.didiglobal.com','app.mokahr.com'],restrictedPaths:{'app.mokahr.com':['/social-recruitment/didiglobal/','/candidate/applications/deliver-query/didiglobal']}},
 {name:'虾皮',letter:'虾',color:'#ffe8df',url:'https://careers.shopee.cn/jobs',hosts:['careers.shopee.cn']},
 {name:'腾讯',letter:'腾',color:'#e0edff',url:'https://join.qq.com/',hosts:['join.qq.com','careers.tencent.com']},
 {name:'联想',letter:'联',color:'#ffe1e6',url:'https://talent.lenovo.com.cn/',hosts:['talent.lenovo.com.cn']},
 {name:'携程',letter:'携',color:'#e1edff',url:'https://careers.ctrip.com/',hosts:['careers.ctrip.com']},
 {name:'网易',letter:'网',color:'#ffe1e6',url:'https://campus.163.com/',hosts:['campus.163.com']},
 {name:'哔哩哔哩',letter:'哔',color:'#dff5ff',url:'https://jobs.bilibili.com/campus',hosts:['jobs.bilibili.com']},
 {name:'小红书',letter:'红',color:'#ffe1e6',url:'https://job.xiaohongshu.com/campus/intern',hosts:['job.xiaohongshu.com','campus.xiaohongshu.com']},
 {name:'商汤',letter:'商',color:'#fff0df',url:'https://hr.sensetime.com/',hosts:['hr.sensetime.com','hr-jobs.sensetime.com']},
 {name:'拼多多',letter:'拼',color:'#ffe1e6',url:'https://careers.pddglobalhr.com/campus/',hosts:['careers.pddglobalhr.com']},
];
/** @param {string} company @param {string} input */
export function canonicalUrl(company,input){
 const url=new URL(input); const site=COMPANIES.find(s=>s.name===company);
 if(url.protocol!=='https:' || url.username || url.password || url.port || !site?.hosts.includes(url.hostname)) throw new Error('请填写对应公司的 HTTPS 招聘官网岗位链接');
 const prefixes=/** @type {Record<string,string[]>|undefined} */(site.restrictedPaths)?.[url.hostname];
 if(prefixes&&!prefixes.some(p=>url.pathname===p||url.pathname.startsWith(p.endsWith('/')?p:p+'/')))throw new Error('该招聘平台链接不属于所选公司的已验证入口');
 for(const key of [...url.searchParams.keys()]) if(/^(utm_|spm$|from$)/.test(key))url.searchParams.delete(key);
 url.searchParams.sort(); return url.toString();
}
/** @param {{location:string,employment:string,title:string,description:string}} job */
export function matchJob(job){
 const text=job.title+'\n'+job.description;
 if(/产品经理|产品运营|市场|销售|招聘|人事|行政/.test(job.title)&&!/算法|研究员|研究实习/.test(job.title))return {state:'excluded',reason:'不是目标算法岗位',direction:''};
 const directions=DIRECTION_PATTERNS;
 const direction=directions.find(([,p])=>/** @type {RegExp} */(p).test(text))?.[0]||'';
 if(!/北京|beijing/i.test(job.location))return {state:job.location.trim()?'excluded':'review',reason:job.location.trim()?'工作地点不含北京':'工作地点未注明',direction:String(direction)};
 if(/非日常|非长期|暑期|转正|校招|全职|应届|summer|graduate/i.test(job.employment))return {state:/日常|长期|daily/i.test(job.employment)?'review':'excluded',reason:'招聘类型需要核对，不能直接认定为日常实习',direction:String(direction)};
 if(!/日常|长期|daily/i.test(job.employment))return {state:'review',reason:'尚未确认是日常实习',direction:String(direction)};
 if(!direction)return {state:'review',reason:'岗位方向需核对',direction:''};
 if(!/算法|模型|机器学习|强化学习|RLHF|RLVR|GRPO|DPO|SFT|algorithm|machine learning/i.test(text))return {state:'review',reason:'需核对是否为算法岗位',direction:String(direction)};
 return {state:'matched',reason:`北京 · 日常实习 · ${direction}`,direction:String(direction)};
}
/** @param {string} raw */
export function normalizeStage(raw){
 if(/未通过|不通过|不匹配|不合适|已拒绝|已终止|流程终止|淘汰|不予录用|流程(?:已)?结束|已完成的流程/.test(raw))return '已结束';
 if(/offer|录用通知|已录用/i.test(raw))return 'Offer';
 if(/面试/.test(raw))return '面试';
 if(/笔试|测评/.test(raw))return '笔试 / 测评';
 if(/筛选|简历初筛|简历复筛|评估|简历评审/.test(raw))return '简历筛选';
 if(/投递成功|已投递|新投递|待处理简历|已申请|申请成功/.test(raw))return '已投递';
 return '待核对';
}
/** @param {string} input */
export function safeCell(input){return /^\s*[=+\-@]|^[\t\r]/.test(input)?"'"+input:input;}
/** @param {Date} [now] */
export function nextCheck(now=new Date()){
 const china=new Date(now.getTime()+8*3600000);
 const next=new Date(Date.UTC(china.getUTCFullYear(),china.getUTCMonth(),china.getUTCDate(),10));
 if(next<=china)next.setUTCDate(next.getUTCDate()+1);
 while([0,6].includes(next.getUTCDay()))next.setUTCDate(next.getUTCDate()+1);
 return new Date(next.getTime()-8*3600000).toISOString();
}
/** @param {{applied?:number|boolean,appliedAt?:string|null}} job */
export function hasApplied(job){return !!(job.applied||job.appliedAt);}
/** @param {string} value @param {Date} [now] */
export function isFutureApplicationDate(value,now=new Date()){
 return value.length===10?value>new Date(now.getTime()+8*3600000).toISOString().slice(0,10):new Date(value)>now;
}
