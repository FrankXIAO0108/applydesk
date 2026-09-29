import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

export function verifyDownload(bytes,integrity){
 if(typeof integrity!=='string'||!integrity.startsWith('sha512-'))throw new Error('npm 下载缺少 SHA-512 校验信息');
 if('sha512-'+createHash('sha512').update(bytes).digest('base64')!==integrity)throw new Error('npm 下载校验失败，请检查网络后重试');
}
export async function findNpm(root,{bootstrapOnly=false}={}){
 const dir=path.dirname(process.execPath);
 const candidates=[process.env.npm_execpath,path.join(dir,'node_modules/npm/bin/npm-cli.js'),path.join(dir,'../node_modules/npm/bin/npm-cli.js'),path.join(dir,'../lib/node_modules/npm/bin/npm-cli.js')];
 if(!bootstrapOnly)for(const file of candidates)if(file&&file.endsWith('npm-cli.js')&&existsSync(file))return file;
 const target=path.join(root,'.local/npm'),cli=path.join(target,'package/bin/npm-cli.js');
 if(existsSync(cli))return cli;
 // Codex may ship Node without npm. Bootstrap npm only from its official registry,
 // verify the registry's integrity hash, and keep it inside this project.
 console.error('正在准备 npm（仅首次需要）…');
 const metaResponse=await fetch('https://registry.npmjs.org/npm/11.16.0',{signal:AbortSignal.timeout(30000)});
 if(!metaResponse.ok)throw new Error('无法连接 npm 官方仓库，请检查网络后重试');
 const meta=await metaResponse.json(),url=new URL(meta.dist.tarball);
 if(url.origin!=='https://registry.npmjs.org')throw new Error('npm 下载来源不符合预期');
 const response=await fetch(url,{signal:AbortSignal.timeout(60000)});if(!response.ok)throw new Error('npm 下载失败');
 const bytes=Buffer.from(await response.arrayBuffer());verifyDownload(bytes,meta.dist.integrity);
 mkdirSync(target,{recursive:true});const archive=path.join(target,'npm.tgz');writeFileSync(archive,bytes);
 const list=spawnSync('tar',['-tzf',archive],{encoding:'utf8',windowsHide:true});
 if(list.status!==0||list.stdout.split(/\r?\n/).filter(Boolean).some(p=>!p.startsWith('package/')||p.split('/').includes('..')))throw new Error('npm 压缩包内容无效');
 const extracted=spawnSync('tar',['-xzf',archive,'-C',target],{stdio:'inherit',windowsHide:true});
 if(extracted.status!==0||!existsSync(cli))throw new Error('无法解压 npm；请让 Codex 按 START_HERE.md 检查运行环境');return cli;
}
