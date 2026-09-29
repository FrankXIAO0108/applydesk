import './runtime.mjs';
import {existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
if(existsSync('work/qa-cleanup.sql')){
 const result=spawnSync(process.execPath,['--import',new URL('./runtime.mjs',import.meta.url).href,fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js',import.meta.url)),'d1','execute','DB','--local','--config','wrangler.jsonc','--persist-to','.wrangler/state','--file','work/qa-cleanup.sql'],{stdio:'inherit',windowsHide:true});
 if(result.error)throw result.error;process.exitCode=result.status??1;
}
