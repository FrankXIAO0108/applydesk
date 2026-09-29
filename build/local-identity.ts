import type {Plugin} from 'vite';
import {createLocalApplications} from './local-applications.mjs';
// Development only. Incoming identity headers are stripped before a local
// identity is supplied, and both the hostname and TCP peer must be loopback.
export function localIdentity():Plugin{return {name:'applydesk-local-identity',configureServer(server){
 const applications=createLocalApplications(process.cwd());
 server.middlewares.use((req,res,next)=>{
   delete req.headers['x-applydesk-local-user'];
   for(let i=req.rawHeaders.length-2;i>=0;i-=2){if(req.rawHeaders[i].toLowerCase()==='x-applydesk-local-user')req.rawHeaders.splice(i,2);}
   const peer=req.socket.remoteAddress||'';
   let host='';try{host=new URL('http://'+req.headers.host).hostname.replace(/^\[|\]$/g,'');}catch{}
   if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(peer)||!['localhost','127.0.0.1','::1'].includes(host)){res.statusCode=403;res.end('ApplyDesk development server is loopback-only');return;}
   if(req.headers.origin){try{const origin=new URL(req.headers.origin);if(origin.host!==req.headers.host){res.statusCode=403;res.end('Cross-origin request rejected');return;}}catch{res.statusCode=403;res.end();return;}}
   req.headers['x-applydesk-local-user']='local-user';
   req.rawHeaders.push('x-applydesk-local-user','local-user');void applications(req,res,next);
 });
}};}
