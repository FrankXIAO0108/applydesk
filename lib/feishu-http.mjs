/** @param {string} path @param {string} method @param {unknown} body @param {string} [token] @param {typeof fetch} [transport] */
export async function feishuRequest(path,method,body,token,transport=fetch){
 const response=await transport('https://open.feishu.cn/open-apis/'+path,{method,redirect:'manual',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
 if(response.status>=300&&response.status<400)throw new Error('飞书接口返回了意外重定向，已停止请求');
 if(!response.ok)throw new Error(`飞书请求失败（HTTP ${response.status}）`);
 const data=await response.json();
 if(data.code!==0)throw new Error(`飞书请求失败（${data.code??'未知错误'}），请检查应用权限与表格授权`);
 return data;
}
