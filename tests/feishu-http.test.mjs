import test from 'node:test';
import assert from 'node:assert/strict';
import {feishuRequest} from '../lib/feishu-http.mjs';
test('Cloudflare-compatible fetch: no credential-bearing redirects',async()=>{
 let calls=0;
 const transport=async(url,init)=>{calls++;assert.equal(init.redirect,'manual');assert.equal(init.headers.Authorization,'Bearer test-token');return new Response(null,{status:302,headers:{Location:'https://other.test'}});};
 await assert.rejects(feishuRequest('sheets/v3/spreadsheets','POST',{},'test-token',transport),/重定向/);assert.equal(calls,1);
});
test('successful Feishu response is returned',async()=>{const r=await feishuRequest('test','GET',null,undefined,async()=>Response.json({code:0,data:{ok:true}}));assert.equal(r.data.ok,true);});
test('business error is not reported as success or echoed with secret values',async()=>{await assert.rejects(feishuRequest('test','GET',null,undefined,async()=>Response.json({code:99991672,msg:'some-sensitive-value'})),e=>e.message.includes('99991672')&&!e.message.includes('sensitive'));});
