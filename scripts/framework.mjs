import './runtime.mjs';
import {fileURLToPath} from 'node:url';
const [command,...args]=process.argv.slice(2);
if(!['dev','build'].includes(command))throw new Error('Use dev or build');
const cli=new URL('../node_modules/vinext/dist/cli.js',import.meta.url);
process.argv=[process.execPath,fileURLToPath(cli),command,...(command==='dev'?['--hostname','127.0.0.1','--port',process.env.APPLYDESK_PORT||'5173']:[]),...args];
await import(cli.href);
