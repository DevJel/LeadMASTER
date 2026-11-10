import test from 'node:test';
import assert from 'node:assert/strict';
import {routeHttp} from '../src/http-router.mjs';
const key='A'.repeat(43), id='request_1234567890';
const job={to:'recipient@example.test',subject:'Hello',text:'A message'};
function req(data=job, options={}) {return new Request('https://example.test/api/v1/emails',{method:'POST',headers:{'content-type':'application/json','idempotency-key':id,authorization:`Bearer ${key}`,...options.headers},body:typeof data==='string'?data:JSON.stringify(data)});}
function setup(){let jobs=[];return {jobs,env:{EMAIL_API_ENABLED:'true',EMAIL_API_KEY:key,EMAIL_QUEUE:{send:async value=>jobs.push(value)}}};}
test('is disabled and fail-closed without bindings and returns no secret',async()=>{const r=await routeHttp(req(),{});assert.equal(r.status,503);assert.doesNotMatch(await r.text(),new RegExp(key));});
test('requires an authorized bearer token and never calls the queue for invalid credentials',async()=>{const {env,jobs}=setup();for(const token of ['',`Bearer ${'B'.repeat(43)}`,'Basic abc']){const r=await routeHttp(req(job,{headers:{authorization:token}}),env);assert.equal(r.status,401)}assert.equal(jobs.length,0)});
test('accepts exactly one validated message into the queue',async()=>{const {env,jobs}=setup();const r=await routeHttp(req(),env);assert.equal(r.status,202);assert.deepEqual(await r.json(),{id,status:'queued'});assert.deepEqual(jobs,[{id,...job}]);assert.equal(r.headers.get('cache-control'),'no-store')});
test('rejects malformed and unsafe inputs',async()=>{const {env,jobs}=setup();for(const request of [req('{'),req({...job,to:'bad\r\nInjected'}),req({...job,extra:'bad'}),req(job,{headers:{'idempotency-key':'short'}}),req('x'.repeat(100001))]){const r=await routeHttp(request,env);assert.ok([400,413].includes(r.status))}assert.equal(jobs.length,0)});
test('returns unavailable on queue failure rather than claiming acceptance',async()=>{const {env}=setup();env.EMAIL_QUEUE.send=async()=>{throw Error('sensitive internal detail')};const r=await routeHttp(req(),env);assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/sensitive/)});
test('rejects invalid config and methods',async()=>{const {env}=setup();env.EMAIL_API_KEY='weak';assert.equal((await routeHttp(req(),env)).status,503);assert.equal((await routeHttp(new Request('https://example.test/api/v1/emails'),env)).status,405)});
test('accepts a secret binding without exposing the secret',async()=>{const {env}=setup();env.EMAIL_API_KEY={get:async()=>key};const r=await routeHttp(req(),env);assert.equal(r.status,202);assert.doesNotMatch(await r.text(),new RegExp(key))});
test('rejects incorrect content type and invalid UTF-8 without queueing',async()=>{const {env,jobs}=setup();const wrong=req(job,{headers:{'content-type':'text/plain'}});assert.equal((await routeHttp(wrong,env)).status,415);const invalid=new Request('https://example.test/api/v1/emails',{method:'POST',headers:{'content-type':'application/json','idempotency-key':id,authorization:`Bearer ${key}`},body:new Uint8Array([0xff])});assert.equal((await routeHttp(invalid,env)).status,400);assert.equal(jobs.length,0)});
test('accepts a text and HTML email without exposing credentials',async()=>{const {env,jobs}=setup();const html='<h1>Hello</h1>';const r=await routeHttp(req({...job,html}),env);assert.equal(r.status,202);assert.deepEqual(jobs,[{id,...job,html}]);assert.doesNotMatch(await r.text(),new RegExp(key));});
test('rejects malformed or oversized HTML before queueing',async()=>{const {env,jobs}=setup();for(const html of [3,'x'.repeat(100001)])assert.ok([400,413].includes((await routeHttp(req({...job,html}),env)).status));assert.equal(jobs.length,0)});

test('accepts HTML-only and text-only payloads without requiring the other format',async()=>{
 const htmlOnly=setup(),html='<h1>Only HTML</h1>';
 const h=await routeHttp(req({to:'recipient@example.test',subject:'HTML only',html}),htmlOnly.env);
 assert.equal(h.status,202);
 assert.deepEqual(htmlOnly.jobs,[{id,to:'recipient@example.test',subject:'HTML only',html}]);
 const textOnly=setup();
 const t=await routeHttp(req({to:'recipient@example.test',subject:'Text only',text:'Only text',html:''}),textOnly.env);
 assert.equal(t.status,202);
 assert.deepEqual(textOnly.jobs,[{id,to:'recipient@example.test',subject:'Text only',text:'Only text'}]);
});
