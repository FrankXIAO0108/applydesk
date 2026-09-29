import vinext from 'vinext';
import {defineConfig,loadEnv} from 'vite';
import {cloudflare} from '@cloudflare/vite-plugin';
import {localIdentity} from './build/local-identity';
export default defineConfig(({command,mode})=>{
 const values=loadEnv(mode,process.cwd(),'');
 const vars=command==='serve'?Object.fromEntries(['FEISHU_APP_ID','FEISHU_APP_SECRET','FEISHU_FOLDER_TOKEN'].map(k=>[k,k in process.env?process.env[k]||'':values[k]||''])):{};
 return {server:{host:'127.0.0.1',port:5173,strictPort:true},plugins:[
   vinext(),localIdentity(),cloudflare({
     viteEnvironment:{name:'rsc',childEnvironments:['ssr']},inspectorPort:false,
     configPath:'./wrangler.jsonc',config:{vars}
   })
 ]};
});
