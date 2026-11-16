import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
// Exercise the real route with stubbed D1/R2 and no network or real data.
const source=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
const start=source.indexOf('async function adminMailboxRoute('),end=source.indexOf('async function adminSendRoute(',start);
assert(start>=0&&end>start);const context={Response,URL,configuredAdminEmail:async()=> 'admin@example.test',json:(body,status=200)=>Response.json(body,{status}),console};
const route=vm.runInNewContext(source.slice(start,end)+';adminMailboxRoute',context);
const id='12345678-1234-4123-8123-123456789abc';
for(const sourceName of ['admin','developer'])test(`mail detail explains suppression for ${sourceName} send`,async()=>{
 const item={id,recipient:'r@example.test',subject:'Subject',text_body:'body',status:'failed',error_code:'suppressed_at_dispatch'};
 const db={prepare(q){return{bind(){return this},async first(){if(q.includes('COUNT('))return {n:0};if(q.includes('FROM inbound_mail'))return null;if(q.includes('FROM admin_sent_mail'))return sourceName==='admin'?item:null;if(q.includes('FROM developer_email_requests'))return sourceName==='developer'?item:null;throw Error(q)}}}};
 const env={AUTH_DB:db,INBOUND_MAIL:{}};let r=await route(new Request('https://test.invalid/api/admin/mail/'+id),env,{email:'admin@example.test'});assert.equal(r.status,200);assert.equal((await r.json()).error_message,'Not sent: this recipient is on the do-not-contact list.');
});
test('detail authorization still requires admin session',async()=>{const env={};const req=new Request('https://test.invalid/api/admin/mail/'+id);assert.equal((await route(req,env,null)).status,401);assert.equal((await route(req,env,{email:'other@example.test'})).status,403)});
