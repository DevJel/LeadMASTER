import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {emailDraftsRoute} from '../src/email-drafts-api.mjs';
function setup(){const sql=new DatabaseSync(':memory:');sql.exec(readFileSync(new URL('../migrations/0015_account_drafts.sql',import.meta.url),'utf8'));return {AUTH_DB:{prepare(query){let args=[];return {bind(...v){args=v;return this},async all(){return {results:sql.prepare(query).all(...args)}},async first(){return sql.prepare(query).get(...args)||null},async run(){return {meta:{changes:Number(sql.prepare(query).run(...args).changes)}}}}}}};}
const session=(accountId='acct-a')=>({accountId,email:'admin@example.test'}),admin='admin@example.test';
function request(path='/api/admin/drafts',body,method=body?'POST':'GET',origin='https://example.test'){return new Request('https://example.test'+path,{method,headers:method==='GET'?{}:{origin,'content-type':'application/json'},...(body!==undefined?{body:JSON.stringify(body)}:{})});}
const value={to:'recipient@example.test',cc:'',bcc:'',subject:'Hello',text:'Draft body',html:'<p>Draft</p>'};
test('drafts are account scoped across list, detail, update and delete',async()=>{
 const env=setup(),created=await emailDraftsRoute(request(undefined,value),env,session(),admin);assert.equal(created.status,201);const {id}=await created.json(),path='/api/admin/drafts/'+id;
 assert.equal((await (await emailDraftsRoute(request(),env,session(),admin)).json()).drafts.length,1);
 assert.equal((await (await emailDraftsRoute(request(),env,session('acct-b'),admin)).json()).drafts.length,0);
 assert.equal((await (await emailDraftsRoute(request(path),env,session(),admin)).json()).draft.text_body,'Draft body');
 assert.equal((await emailDraftsRoute(request(path),env,session('acct-b'),admin)).status,404);
 assert.equal((await emailDraftsRoute(request(path,{...value,revision:1},'PUT'),env,session('acct-b'),admin)).status,404);
 assert.equal((await emailDraftsRoute(request(path,undefined,'DELETE'),env,session('acct-b'),admin)).status,404);
 assert.equal((await emailDraftsRoute(request(path,undefined,'DELETE'),env,session(),admin)).status,200);
 assert.equal((await emailDraftsRoute(request(path),env,session(),admin)).status,404);
});
test('concurrent edits fail rather than silently overwrite',async()=>{
 const env=setup(),created=await emailDraftsRoute(request(undefined,value),env,session(),admin),{id}=await created.json(),path='/api/admin/drafts/'+id;
 const first=await emailDraftsRoute(request(path,{...value,text:'First',revision:1},'PUT'),env,session(),admin);assert.equal((await first.json()).revision,2);
 assert.equal((await emailDraftsRoute(request(path,{...value,text:'Stale',revision:1},'PUT'),env,session(),admin)).status,409);
 assert.equal((await (await emailDraftsRoute(request(path),env,session(),admin)).json()).draft.text_body,'First');
});
test('requires authentication, administrator, same origin and valid bounded data',async()=>{
 const env=setup();assert.equal((await emailDraftsRoute(request(),env,null,admin)).status,401);
 assert.equal((await emailDraftsRoute(request(),env,session(),'other@example.test')).status,403);
 assert.equal((await emailDraftsRoute(request(undefined,value,'POST','https://evil.test'),env,session(),admin)).status,403);
 assert.equal((await emailDraftsRoute(request(undefined,{}),env,session(),admin)).status,400);
 assert.equal((await emailDraftsRoute(request(undefined,{...value,subject:'x\r\ny'}),env,session(),admin)).status,400);
 assert.equal((await emailDraftsRoute(request(undefined,{...value,text:'a'.repeat(200001)}),env,session(),admin)).status,400);
 assert.equal((await emailDraftsRoute(request(undefined,{...value,revision:1}),env,session(),admin)).status,400);
});
test('missing migration fails closed',async()=>assert.equal((await emailDraftsRoute(request(),{AUTH_DB:{prepare(){throw Error('missing')}}},session(),admin)).status,503));
test('draft routes reject malformed identifiers and absent revision',async()=>{
 const env=setup(),created=await emailDraftsRoute(request(undefined,value),env,session(),admin),{id}=await created.json();
 assert.equal((await emailDraftsRoute(request('/api/admin/drafts/------------------------------------'),env,session(),admin)).status,404);
 assert.equal((await emailDraftsRoute(request('/api/admin/drafts/'+id,value,'PUT'),env,session(),admin)).status,400);
});
test('the account draft limit is enforced without affecting other accounts',async()=>{
 const env=setup();for(let n=0;n<500;n++){const response=await emailDraftsRoute(request(undefined,{subject:'Draft '+n}),env,session(),admin);assert.equal(response.status,201)}
 assert.equal((await emailDraftsRoute(request(undefined,value),env,session(),admin)).status,409);
 assert.equal((await emailDraftsRoute(request(undefined,value),env,session('acct-b'),admin)).status,201);
});
