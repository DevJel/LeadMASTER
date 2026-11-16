import {test} from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';import {emailTemplatesRoute} from '../src/email-templates-api.mjs';
function setup(){const sql=new DatabaseSync(':memory:');sql.exec('CREATE TABLE admin_sent_mail (id TEXT)');sql.exec(readFileSync(new URL('../migrations/0010_email_templates.sql',import.meta.url),'utf8'));const db={prepare(query){let args=[];return {bind(...v){args=v;return this},async all(){return {results:sql.prepare(query).all(...args)}},async first(){return sql.prepare(query).get(...args)||null},async run(){return {meta:{changes:Number(sql.prepare(query).run(...args).changes)}}}}}};return {AUTH_DB:db};}
const session=(id='acct-1')=>({accountId:id,email:'admin@example.test'}),admin='admin@example.test';
function req(path='/api/admin/templates',body,opts={}){const method=opts.method||(body?'POST':'GET');return new Request('https://example.test'+path,{method,headers:{...(method!=='GET'?{'origin':opts.origin||'https://example.test','content-type':'application/json'}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})})}
const sample={name:'Welcome',subject:'Hello',text:'Thank you for joining.'};
test('account-owned template persists, lists, reads and isolates other accounts',async()=>{
 const env=setup(),created=await emailTemplatesRoute(req(undefined,sample),env,session(),admin);assert.equal(created.status,201);let item=await created.json();let r=await emailTemplatesRoute(req(),env,session(),admin);assert.equal((await r.json()).templates.length,1);
 r=await emailTemplatesRoute(req('/api/admin/templates/'+item.id),env,session(),admin);assert.equal((await r.json()).template.text_body,sample.text);
 r=await emailTemplatesRoute(req('/api/admin/templates/'+item.id),env,session('acct-2'),admin);assert.equal(r.status,404);r=await emailTemplatesRoute(req(),env,session('acct-2'),admin);assert.equal((await r.json()).templates.length,0);
});
test('enforces authentication, admin authorization, origin and validation',async()=>{
 const env=setup();assert.equal((await emailTemplatesRoute(req(),env,null,admin)).status,401);assert.equal((await emailTemplatesRoute(req(),env,session(),'other@example.test')).status,403);
 assert.equal((await emailTemplatesRoute(req(undefined,sample,{origin:'https://evil.test'}),env,session(),admin)).status,403);
 assert.equal((await emailTemplatesRoute(req(undefined,{...sample,subject:'hello\r\nInjected'}),env,session(),admin)).status,400);
 assert.equal((await emailTemplatesRoute(req(undefined,{...sample,text:'x'.repeat(50001)}),env,session(),admin)).status,400);
});
test('rejects duplicate names in the same account but not in another',async()=>{
 const env=setup();assert.equal((await emailTemplatesRoute(req(undefined,sample),env,session(),admin)).status,201);
 assert.equal((await emailTemplatesRoute(req(undefined,{...sample,name:'WELCOME'}),env,session(),admin)).status,409);
 assert.equal((await emailTemplatesRoute(req(undefined,sample),env,session('acct-2'),admin)).status,201);
});
test('missing migration fails closed without losing authentication',async()=>{const r=await emailTemplatesRoute(req(),{AUTH_DB:{prepare(){throw Error('missing table')}}},session(),admin);assert.equal(r.status,503)});

test('HTML templates round-trip their HTML and plain-text alternatives',async()=>{const env=setup();const r=await emailTemplatesRoute(req(undefined,{...sample,html:'<h1>Hello</h1>'}),env,session(),admin);assert.equal(r.status,201);const {id}=await r.json();const detail=await emailTemplatesRoute(req('/api/admin/templates/'+id),env,session(),admin);const {template}=await detail.json();assert.equal(template.html_body,'<h1>Hello</h1>');assert.equal(template.text_body,sample.text)});

test('HTML-only template saves, reloads, updates and deletes in D1',async()=>{
 const env=setup(),html='<table><tr><td>Hello</td></tr></table>';
 const created=await emailTemplatesRoute(req(undefined,{name:'HTML Welcome',subject:'Welcome',text:'',html}),env,session(),admin);
 assert.equal(created.status,201);
 const {id}=await created.json();
 let detail=await emailTemplatesRoute(req('/api/admin/templates/'+id),env,session(),admin);
 let template=(await detail.json()).template;
 assert.equal(template.text_body,'');assert.equal(template.html_body,html);
 const updated=await emailTemplatesRoute(req('/api/admin/templates/'+id,{name:'HTML Welcome Updated',subject:'Updated',text:'Plain fallback',html:'<h1>Updated</h1>'},{method:'PUT'}),env,session(),admin);
 assert.equal(updated.status,200);
 detail=await emailTemplatesRoute(req('/api/admin/templates/'+id),env,session(),admin);
 template=(await detail.json()).template;
 assert.equal(template.name,'HTML Welcome Updated');assert.equal(template.text_body,'Plain fallback');assert.equal(template.html_body,'<h1>Updated</h1>');
 const deleted=await emailTemplatesRoute(req('/api/admin/templates/'+id,undefined,{method:'DELETE'}),env,session(),admin);
 assert.equal(deleted.status,200);
 assert.equal((await emailTemplatesRoute(req('/api/admin/templates/'+id),env,session(),admin)).status,404);
});
test('text-only templates do not require HTML',async()=>{
 const env=setup(),created=await emailTemplatesRoute(req(undefined,{name:'Text Welcome',subject:'Welcome',text:'Only text'}),env,session(),admin);
 assert.equal(created.status,201);
 const {id}=await created.json(),detail=await emailTemplatesRoute(req('/api/admin/templates/'+id),env,session(),admin);
 const template=(await detail.json()).template;
 assert.equal(template.text_body,'Only text');assert.equal(template.html_body,null);
});
