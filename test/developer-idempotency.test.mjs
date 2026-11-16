import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { developerEmailRoute } from '../src/developer-api.mjs';
const token='lm_live_'+'A'.repeat(43), account='account-a', idem='request_test_123456';
const body={to:'recipient@example.test',subject:'Hello',text:'Body',html:'<b>Body</b>',sender_name:'Test Sender',reply_to:'reply@example.test'};
const keyHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),x=>x.toString(16).padStart(2,'0')).join('');
function setup(){
 const sql=new DatabaseSync(':memory:');
 sql.exec(readFileSync(new URL('../migrations/0002_developer_email_api.sql',import.meta.url),'utf8'));
 sql.exec(`ALTER TABLE developer_api_keys ADD COLUMN account_id TEXT;
 ALTER TABLE developer_email_requests ADD COLUMN account_id TEXT;
 ALTER TABLE developer_email_requests ADD COLUMN from_email TEXT;
 ALTER TABLE developer_email_requests ADD COLUMN sender_name TEXT;
 ALTER TABLE developer_email_requests ADD COLUMN reply_to TEXT;
 ALTER TABLE developer_email_requests ADD COLUMN text_body TEXT;
 ALTER TABLE developer_email_requests ADD COLUMN html_body TEXT;
 CREATE TABLE accounts (id TEXT PRIMARY KEY,name TEXT,owner_email TEXT,owner_name TEXT,updated_at INTEGER);
 CREATE TABLE auth_rate_limits (bucket_key TEXT PRIMARY KEY,window_start INTEGER,count INTEGER);
 CREATE TABLE email_unsubscribes (email TEXT);
 CREATE TABLE workspace_activity (id TEXT,actor_email TEXT,action TEXT,summary TEXT,target_id TEXT,created_at INTEGER);`);
 sql.exec(readFileSync(new URL('../migrations/0021_developer_request_fingerprint.sql',import.meta.url),'utf8'));
 sql.prepare('INSERT INTO developer_api_keys (id,name,key_prefix,key_hash,scopes,created_by,created_at,account_id) VALUES (?,?,?,?,?,?,?,?)').run('key-a','key',token.slice(0,16),keyHash,'["email:send"]','owner@example.test',1,account);
 sql.prepare('INSERT INTO accounts VALUES (?,?,?,?,?)').run(account,'My workspace','owner@example.test','Owner',1);
 const db={prepare(query){let values=[];return {bind(...v){values=v;return this},async first(){return sql.prepare(query).get(...values)||null},async run(){return {meta:{changes:Number(sql.prepare(query).run(...values).changes)}}}}}};
 const jobs=[];return {sql,jobs,env:{AUTH_DB:db,MAIL_SEND_QUEUE:{async send(job){jobs.push(job)}}}};
}
function req(value=body){return new Request('https://example.test/api/v1/accounts/'+account+'/emails',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json','idempotency-key':idem},body:JSON.stringify(value)})}
async function send(s,value=body){return developerEmailRoute(req(value),s.env,null,account)}
test('same key and payload replay without a second queue submission despite changed account name',async()=>{
 const s=setup(),first=await send(s);assert.equal(first.status,202);
 s.sql.prepare('UPDATE accounts SET owner_name=? WHERE id=?').run('Changed Owner',account);
 const replay=await send(s);assert.equal(replay.status,202);assert.equal((await replay.json()).replayed,true);assert.equal(s.jobs.length,1);
});
test('different recipient, subject, body, sender or reply address conflicts without enqueueing',async()=>{
 const s=setup();assert.equal((await send(s)).status,202);
 for(const changed of [{to:'other@example.test'},{subject:'Changed'},{text:'Changed'},{html:'<b>Changed</b>'},{sender_name:'Other Name'},{reply_to:'other@example.test'}]){
  const response=await send(s,{...body,...changed});assert.equal(response.status,409,JSON.stringify(changed));assert.match((await response.json()).error,/different request/);
 }
 assert.equal(s.jobs.length,1);assert.equal(s.sql.prepare('SELECT owner_name FROM accounts WHERE id=?').get(account).owner_name,'Test Sender');
});
test('legacy rows fail closed, preserve the record, and provide its ID for reconciliation',async()=>{
 const s=setup();s.sql.prepare("INSERT INTO developer_email_requests (id,api_key_id,idempotency_key,recipient,subject,status,created_at,updated_at,account_id) VALUES (?,?,?,?,?,'sending',?,?,?)").run('legacy-id','key-a',idem,body.to,body.subject,1,1,account);
 const response=await send(s);assert.equal(response.status,409);const result=await response.json();assert.equal(result.id,'legacy-id');assert.match(result.error,/reconcile/);assert.equal(s.jobs.length,0);
 assert.equal(s.sql.prepare('SELECT request_fingerprint FROM developer_email_requests WHERE id=?').get('legacy-id').request_fingerprint,null);
});
test('concurrent identical requests enqueue at most once',async()=>{
 const s=setup();const results=await Promise.all([send(s),send(s)]);assert.ok(results.some(r=>r.status===202));assert.ok(results.every(r=>[202,409].includes(r.status)));assert.equal(s.jobs.length,1);assert.equal(s.sql.prepare('SELECT count(*) AS n FROM developer_email_requests').get().n,1);
});

test('terminal outcomes replay as status responses rather than newly queued sends',async()=>{
 const s=setup();assert.equal((await send(s)).status,202);
 for(const state of ['accepted','failed','unknown']){
  s.sql.prepare('UPDATE developer_email_requests SET status=? WHERE idempotency_key=?').run(state,idem);
  const response=await send(s);assert.equal(response.status,200);const result=await response.json();assert.equal(result.status,state);assert.equal(result.replayed,true);
 }
 assert.equal(s.jobs.length,1);
});
