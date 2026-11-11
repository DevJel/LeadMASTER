import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
const start=source.indexOf('function parseOptionalAddressList('),end=source.indexOf('\nasync function handle(',start);
const code=source.slice(start,end)+'\nthis.adminSendRoute=adminSendRoute;';
const json=(value,status=200)=>Response.json(value,{status});
const context={json,configuredAdminEmail:async()=> 'admin@example.test',sameOrigin:()=>true,readBoundedJson:async request=>request.json(),crypto,TextEncoder,console};
vm.runInNewContext(code,context);
const run=body=>context.adminSendRoute(new Request('https://example.test/api/admin/send',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),{MAIL_SEND_QUEUE:{},AUTH_DB:{}},{email:'admin@example.test'});
test('multiple To recipients with CC or BCC are rejected before creating or sending mail',async()=>{
 for(const field of ['cc','bcc']){const response=await run({to:'one@example.test, two@example.test',[field]:'copy@example.test',subject:'Subject',text:'Body'});assert.equal(response.status,400);assert.match((await response.json()).error,/remove CC and BCC/);}
});
