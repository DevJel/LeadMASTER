import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
const start=source.indexOf('function parseOptionalAddressList('),end=source.indexOf('\nasync function handle(',start);
assert(start>=0&&end>start);
const code=source.slice(start,end)+'\nthis.adminSendRoute=adminSendRoute;';
let readCalled=false;
const context={
 json:(value,status=200)=>Response.json(value,{status}),
 configuredAdminEmail:async()=> 'admin@example.test',
 sameOrigin:()=>true,
 readBoundedJson:async()=>{readCalled=true;throw new Error('should not read oversized body');},
 crypto,TextEncoder,console
};
vm.runInNewContext(code,context);

test('oversized email requests are rejected clearly before parsing or queueing',async()=>{
 const request=new Request('https://example.test/api/admin/send',{
  method:'POST',
  headers:{'content-type':'application/json','content-length':'13358784'}
 });
 const response=await context.adminSendRoute(request,{MAIL_SEND_QUEUE:{},AUTH_DB:{}},{email:'admin@example.test'});
 assert.equal(response.status,413);
 assert.match((await response.json()).error,/base64 images/);
 assert.equal(readCalled,false);
});
