import { test } from 'node:test';
import assert from 'node:assert/strict';
import { routeHttp } from '../src/http-router.mjs';
const token='a'.repeat(43), env={MCP_EXPERIMENTAL_ENABLED:'true',MCP_ACCESS_TOKEN:{get:async()=>token}};
const hdr={authorization:`Bearer ${token}`,'content-type':'application/json',accept:'application/json, text/event-stream','mcp-protocol-version':'2025-11-25'};
const call=(body,headers=hdr,e=env)=>routeHttp(new Request('https://example.com/mcp',{method:'POST',headers,body:JSON.stringify(body)}),e);
const rpc=(method,params={},id=1)=>({jsonrpc:'2.0',id,method,params});
test('MCP fails closed unless enabled and configured',async()=>{
 assert.equal((await call(rpc('tools/list'),hdr,{})).status,503);
 assert.equal((await call(rpc('tools/list'),hdr,{MCP_EXPERIMENTAL_ENABLED:'true'})).status,503);
 assert.equal((await call(rpc('tools/list'),{...hdr,authorization:'Bearer '+ 'b'.repeat(43)})).status,401);
 assert.equal((await call(rpc('tools/list'),{...hdr,origin:'https://untrusted.example'})).status,403);
});
test('MCP initializes and exposes only the read-only tools',async()=>{
 const init=await call(rpc('initialize',{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'test',version:'1'}}));
 assert.equal(init.status,200);assert.ok((await init.json()).result.serverInfo.name==='leadmaster');
 const response=await call(rpc('tools/list'));assert.equal(response.status,200);
 const result=await response.json();assert.deepEqual(result.result.tools.map(t=>t.name).sort(),['get_email_capabilities','validate_email']);
});
test('validation checks payload without sending or echoing sensitive contents',async()=>{
 const response=await call(rpc('tools/call',{name:'validate_email',arguments:{to:'person@example.org',subject:'Hello',text:'Private message'}}));
 const value=await response.json();const parsed=JSON.parse(value.result.content[0].text);
 assert.equal(parsed.valid,true);assert.equal(parsed.sent,false);assert.ok(!JSON.stringify(value).includes('Private message'));
 const bad=await call(rpc('tools/call',{name:'validate_email',arguments:{to:'bad',subject:'a',text:'b'}}));
 assert.equal(JSON.parse((await bad.json()).result.content[0].text).valid,false);
});
test('limits request size before parsing',async()=>{
 const response=await call(rpc('tools/call',{name:'validate_email',arguments:{to:'a@example.org',subject:'a',text:'a'.repeat(100001)}}));assert.equal(response.status,413);
});
test('origin allowlist is exact and applies alongside authentication',async()=>{
 const withOrigin={...hdr,origin:'https://client.example'};
 assert.equal((await call(rpc('tools/list'),withOrigin,{...env,MCP_ALLOWED_ORIGIN:'https://client.example'})).status,200);
 assert.equal((await call(rpc('tools/list'),{...withOrigin,origin:'https://client.example.evil.test'},{...env,MCP_ALLOWED_ORIGIN:'https://client.example'})).status,403);
});
test('secret retrieval failures and unsupported methods fail closed',async()=>{
 assert.equal((await call(rpc('tools/list'),hdr,{...env,MCP_ACCESS_TOKEN:{get:async()=>{throw Error('unavailable')}}})).status,503);
 assert.equal((await routeHttp(new Request('https://example.com/mcp',{method:'GET',headers:hdr}),env)).status,405);
});
