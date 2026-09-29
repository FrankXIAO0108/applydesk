import {readdir,readFile} from 'node:fs/promises';
const ignore=new Set(['.git','node_modules','dist','.next','.vinext','.wrangler','.local','work','__pycache__']);
const patterns=[/appgprj_[a-z0-9]+/i,/appgdep_[a-z0-9]+/i,/[a-z0-9-]+\.[a-z0-9-]+\.chatgpt\.site/i,/cli_[a-z0-9]{12,}/i,/(?:ghp_|github_pat_)[a-zA-Z0-9_]{20,}/,/C:[\\/]Users[\\/](?!Public\b)[^\s/\\]+/i,/https:\/\/[a-z0-9]+\.feishu\.cn\/(?:sheets|wiki)\/[a-z0-9]{15,}/i];
let failures=[];
async function walk(dir){for(const f of await readdir(dir,{withFileTypes:true})){if(ignore.has(f.name)||f.name==='check-export.mjs')continue;const p=dir+'/'+f.name;if(f.isDirectory())await walk(p);else if(/\.(?:ts|tsx|js|mjs|json|jsonc|md|yml|yaml|css|example|txt)$/.test(f.name)||f.name==='.gitignore'){const s=await readFile(p,'utf8');if(patterns.some(r=>r.test(s)))failures.push(p);}}}
await walk('.');if(failures.length){console.error('Potential private deployment/account data:',failures);process.exitCode=1;}else console.log('Export check passed: no known private deployment/account markers.');
