import './runtime.mjs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const result=spawnSync(process.execPath,['--import',new URL('./runtime.mjs',import.meta.url).href,fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js',import.meta.url)),'d1','migrations','apply','DB','--local','--config','wrangler.jsonc','--persist-to','.wrangler/state'],{stdio:'inherit',windowsHide:true});
if(result.error)throw result.error;process.exitCode=result.status??1;
