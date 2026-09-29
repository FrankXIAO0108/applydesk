import os from 'node:os';
import {syncBuiltinESMExports} from 'node:module';
try{os.userInfo();}catch{os.userInfo=()=>({username:process.env.USERNAME||'local',homedir:os.homedir(),uid:-1,gid:-1,shell:null});syncBuiltinESMExports();}
process.argv[2]='generate';await import('../node_modules/drizzle-kit/bin.cjs');
