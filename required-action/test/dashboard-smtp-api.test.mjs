import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const compiled = await build({entryPoints:['src/dashboard-tsx/smtp-api.ts'],bundle:true,write:false,platform:'node',format:'esm',logLevel:'silent'});
const {smtpApi,SmtpApiError} = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const id='22222222-2222-4222-8222-222222222222';
const config={name:'Sender',email:'sender@example.test',server:'smtp.example.test',username:'user',password:'test-only',port:587,security:'starttls'};

test('settings use same-origin, no-store requests and preserve the configuration',async()=>{
 const calls=[];const api=smtpApi(async (url,options)=>{calls.push({url,options});return Response.json({connections:[],id});});
 await api.list();await api.create(config);assert.equal(calls.length,2);
 for(const call of calls){assert.equal(call.options.credentials,'same-origin');assert.equal(call.options.cache,'no-store');}
 assert.equal(calls[0].url,'/api/admin/smtp');assert.equal(calls[0].options.method,'GET');
 assert.equal(calls[1].options.method,'POST');assert.equal(calls[1].options.headers['content-type'],'application/json');
 assert.deepEqual(JSON.parse(calls[1].options.body),{config});
});
test('connection edits and monitoring encode the expected path and revision',async()=>{
 const calls=[];const api=smtpApi(async (url,options)=>{calls.push({url,options});return Response.json(String(url).endsWith('/test')?{status:'connected'}:{});});
 await api.replace(id,3,config);await api.revoke(id,4);await api.activity(id,{createdAt:123,messageId:id});await api.testConnection(id,4);
 assert.equal(calls[0].url,`/api/admin/smtp/${id}`);assert.deepEqual(JSON.parse(calls[0].options.body),{revision:3,config});
 assert.equal(calls[1].options.method,'DELETE');assert.deepEqual(JSON.parse(calls[1].options.body),{revision:4});
 const url=new URL(calls[2].url,'https://example.test');assert.equal(url.pathname,`/api/admin/smtp/${id}/activity`);
 assert.equal(calls[3].url,`/api/admin/smtp/${id}/test`);assert.deepEqual(JSON.parse(calls[3].options.body),{revision:4});assert.equal(url.searchParams.get('before_time'),'123');assert.equal(url.searchParams.get('before_id'),id);assert.equal(url.searchParams.get('limit'),'50');
});
test('rejects invalid IDs before performing a request',async()=>{
 let calls=0;const api=smtpApi(async()=>{calls++;return Response.json({})});
 assert.throws(()=>api.activity('../bad'));assert.throws(()=>api.revoke('bad',1));assert.equal(calls,0);
});
test('network and unreadable response failures never automatically retry writes',async()=>{
 let calls=0;const api=smtpApi(async()=>{calls++;throw Error('network')});
 await assert.rejects(api.create(config),e=>e instanceof SmtpApiError&&e.uncertain&&/Refresh/.test(e.message));assert.equal(calls,1);
 const unreadable=smtpApi(async()=>new Response('not json',{status:502}));
 await assert.rejects(unreadable.create(config),e=>e instanceof SmtpApiError&&e.uncertain);
});
test('HTTP error distinguishes uncertain server failures from validation errors',async()=>{
 const fail=status=>smtpApi(async()=>Response.json({error:'Unavailable'},{status}));
 await assert.rejects(fail(503).create(config),e=>e instanceof SmtpApiError&&e.uncertain);
 await assert.rejects(fail(400).create(config),e=>e instanceof SmtpApiError&&!e.uncertain);
});

test('connection test requires a real connected response',async()=>{const api=smtpApi(async()=>Response.json({}));await assert.rejects(api.testConnection(id,1),e=>e instanceof SmtpApiError&&e.uncertain)});
