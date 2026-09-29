export const RECRUITMENT_TYPES=['日常实习','暑期实习','全部实习','秋招','春招','全部校招','社招','不限类型'];
export const BROWSER_LABELS={auto:'自动选择已连接浏览器',edge:'Microsoft Edge',chrome:'Google Chrome'};

/** Match explicit recruiting labels. Do not infer autumn/spring from dates or graduation year. */
export function matchRecruitment(job,selected='日常实习'){
 const text=[job.employment||'',job.title||''].join(' ');
 const result=(state,reason)=>({state,reason});
 if(selected==='不限类型')return result('matched','招聘类型不限');
 if(/非日常|非长期|不招实习|非实习/.test(text))return result('review','招聘类型含否定说明，需要核对');
 const intern=/实习|\bintern(?:ship)?\b/i.test(text),daily=/日常|长期实习|daily\s*intern/i.test(text),summer=/暑期|暑假|summer/i.test(text)&&intern;
 const autumn=/秋招|秋季.{0,4}(?:招聘|校招)|(?:autumn|fall).{0,12}(?:campus|graduate)/i.test(text);
 const spring=/春招|春季.{0,4}(?:招聘|校招)|spring.{0,12}(?:campus|graduate)/i.test(text);
 const campus=autumn||spring||/校招|校园招聘|应届|campus|new\s*grad|graduate\s*(?:program|recruit)/i.test(text);
 const social=/社招|社会招聘|experienced\s*hire/i.test(text);
 if((intern&&(autumn||spring||social))||(social&&campus)||(daily&&summer))return result('review','招聘类型存在多个冲突标签，需要核对');
 if(selected==='全部实习')return result(intern?'matched':campus||social?'excluded':'review',intern?'实习岗位':campus||social?'不是实习岗位':'尚未确认招聘类型');
 if(selected==='日常实习'||selected==='暑期实习'){
  if((selected==='日常实习'&&daily&&intern)||(selected==='暑期实习'&&summer))return result('matched',selected);
  if(campus||social||(selected==='日常实习'&&summer)||(selected==='暑期实习'&&daily))return result('excluded','招聘类型不符合设置');
  return result('review','未明确标注'+selected);
 }
 if(selected==='全部校招')return result(intern||social?'excluded':campus?'matched':'review',intern||social?'不是全职校招岗位':campus?'校招岗位':'尚未确认是校招');
 if(selected==='秋招'||selected==='春招'){
  if(intern||social)return result('excluded','不是目标校招类型');
  if(selected==='秋招'?autumn:spring)return result('matched',selected);
  if(selected==='秋招'?spring:autumn)return result('excluded','招聘季不符合设置');
  return result('review',campus?'官网只标注校招，未注明春招或秋招':'尚未确认招聘季');
 }
 if(selected==='社招')return result(intern||campus?'excluded':social?'matched':'review',intern||campus?'不是社招岗位':social?'社招岗位':'全职不等于社招，需要核对');
 return result('review','未知招聘类型');
}
