import {test} from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';import {externalSmtpSettingsRoute} from '../src/external-smtp-settings-api.mjs';
const a='acct_'+'A'.repeat(22),b='acct_'+'B'.repeat(22),admin='admin@example.test',session=(accountId=a)=>({email:admin,accountId}),key=Buffer.alloc(32,12).toString('base64');
const config={name:'Sales',email:'sales@example.com',server:'smtp.example.com',username:'private-user',password:'private-secret'};
function setup(){const sql=new DatabaseSync(':memory:');for(const f of ['0016_external_smtp_activity.sql','0017_external_smtp_connections.sql'])sql.exec(readFileSync(new URL('../migrations/'+f,import.meta.url),'utf8'));const AUTH_DB={prepare(q){let a=[];return{bind(...v){a=v;return this},async first(){return sql.prepare(q).get(...a)||null},async all(){return {results:sql.prepare(q).all(...a)}},async run(){return {meta:{changes:Number(sql.prepare(q).run(...a).changes)}}}}}};return {AUTH_DB,SMTP_CREDENTIAL_KEY:key,SMTP_CREDENTIAL_KEY_ID:'v1'}}
function req(path='/api/admin/smtp',method='GET',body,origin='https://example.test'){return new Request('https://example.test'+path,{method,headers:method==='GET'?{}:{origin,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})})}
const route=(request,env,s=session())=>externalSmtpSettingsRoute(request,env,s,admin);
test('requires account session, administrator, and same-origin mutations',async()=>{const e=setup();assert.equal((await route(req(),e,null)).status,401);assert.equal((await route(req(),e,{email:'other@example.test',accountId:a})).status,403);assert.equal((await route(req(undefined,'POST',{config},'https://evil.test'),e)).status,403)});
test('create, list, edit and revoke never return credential values',async()=>{
 const e=setup(),create=await route(req(undefined,'POST',{config}),e);assert.equal(create.status,201);const {id}=await create.json();const list=await route(req(),e),text=await list.text();assert.ok(!text.includes(config.username)&&!text.includes(config.password)&&!text.includes('ciphertext'));assert.equal(JSON.parse(text).connections[0].verification_status,'unverified');
 const path='/api/admin/smtp/'+id;assert.equal((await route(req(path,'PUT',{config,revision:1}),e,session(b))).status,409);
 assert.equal((await route(req(path,'PUT',{config:{...config,name:'Changed'},revision:1}),e)).status,200);assert.equal((await route(req(path,'DELETE',{revision:1}),e)).status,409);assert.equal((await route(req(path,'DELETE',{revision:2}),e)).status,200);assert.equal((await (await route(req(),e)).json()).connections.length,0);
});
test('activity requires ownership and never exposes other account data',async()=>{
 const e=setup(),{id}=await (await route(req(undefined,'POST',{config}),e)).json();const path='/api/admin/smtp/'+id+'/activity';assert.equal((await route(req(path),e,session(b))).status,404);
 const r=await route(req(path),e);assert.equal(r.status,200);assert.deepEqual((await r.json()).items,[]);assert.equal((await route(req(path+'?before_time=5'),e)).status,400);
});
test('invalid payloads, absent keys and unsupported routes fail closed',async()=>{
 const e=setup();assert.equal((await route(req(undefined,'POST',{config:{...config,server:'localhost'}}),e)).status,400);
 assert.equal((await route(req(undefined,'POST',{config,extra:true}),e)).status,400);delete e.SMTP_CREDENTIAL_KEY;assert.equal((await route(req(undefined,'POST',{config}),e)).status,503);
 assert.equal((await route(req('/api/admin/smtp/------------------------------------'),e)).status,404);assert.equal((await route(req('/api/admin/smtp/11111111-1111-4111-8111-111111111111/test','POST',{}),e)).status,404);
});
