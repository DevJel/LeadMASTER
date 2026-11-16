import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { webhookRoute, deliverWebhookEvent } from '../src/developer-webhooks.mjs';
const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),x=>x.toString(16).padStart(2,'0')).join('');
async function setup(){
 const sql=new DatabaseSync(':memory:');for(const f of ['0002_developer_email_api.sql','0003_developer_webhooks.sql'])sql.exec(readFileSync(new URL('../migrations/'+f,import.meta.url),'utf8'));
 sql.exec('ALTER TABLE developer_api_keys ADD COLUMN account_id TEXT; ALTER TABLE developer_webhooks ADD COLUMN account_id TEXT;');
 const db={prepare(q){let values=[];return {bind(...v){values=v;return this},async first(){return sql.prepare(q).get(...values)||null},async all(){return {results:sql.prepare(q).all(...values)}},async run(){return {meta:{changes:Number(sql.prepare(q).run(...values).changes)}}}}}};
 const env={AUTH_DB:db,SESSION_SECRET:'test-only-encryption-secret'};
 const keys=[['key-a','account-a','A'],['key-b','account-a','B'],['key-c','account-b','C']];
 for(const [id,account,c] of keys){const token='lm_live_'+c.repeat(43);sql.prepare('INSERT INTO developer_api_keys (id,name,key_prefix,key_hash,scopes,created_by,created_at,account_id) VALUES (?,?,?,?,?,?,?,?)').run(id,id,token.slice(0,16),await hash(token),'["webhook:manage"]','owner@example.test',1,account)}
 async function hook(index,url,events){const [,account,c]=keys[index];const req=new Request('https://leadmaster.example.com/api/v1/accounts/'+account+'/webhooks',{method:'POST',headers:{authorization:'Bearer lm_live_'+c.repeat(43),'content-type':'application/json'},body:JSON.stringify({name:'hook',url,events})});const response=await webhookRoute(req,env,account);assert.equal(response.status,201);return response.json()}
 return {sql,env,hook};
}
test('failed event delivers only to subscribed, active hooks for the owning account and key',async()=>{
 const s=await setup();const target=await s.hook(0,'https://first.acme.com/hook',['email.failed']);
 await s.hook(0,'https://accepted.acme.com/hook',['email.accepted']);await s.hook(1,'https://otherkey.acme.com/hook',['email.failed']);await s.hook(2,'https://otheraccount.acme.com/hook',['email.failed']);
 const revoked=await s.hook(0,'https://revoked.acme.com/hook',['email.failed']);s.sql.prepare('UPDATE developer_webhooks SET revoked_at=1 WHERE id=?').run(revoked.id);
 const calls=[],previous=globalThis.fetch;globalThis.fetch=async(url,options)=>{calls.push({url,options});return new Response(null,{status:204})};
 try{await deliverWebhookEvent(s.env,'email.failed',{request_id:'request-1',error_code:'delivery_not_accepted'},'key-a','account-a')}finally{globalThis.fetch=previous}
 assert.equal(calls.length,1);assert.equal(calls[0].url,'https://first.acme.com/hook');assert.equal(calls[0].options.redirect,'manual');
 const payload=JSON.parse(calls[0].options.body);assert.equal(payload.type,'email.failed');assert.equal(payload.data.error_code,'delivery_not_accepted');
 const timestamp=calls[0].options.headers['leadmaster-timestamp'];const signingKey=await crypto.subtle.importKey('raw',new TextEncoder().encode(target.signing_secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',signingKey,new TextEncoder().encode(timestamp+'.'+calls[0].options.body))),x=>x.toString(16).padStart(2,'0')).join('');
 assert.equal(calls[0].options.headers['leadmaster-signature'],'v1='+signature);
 const rows=s.sql.prepare('SELECT webhook_id,event_type,http_status,success FROM developer_webhook_deliveries').all();assert.equal(rows.length,1);assert.equal(rows[0].webhook_id,target.id);assert.equal(rows[0].event_type,'email.failed');assert.equal(rows[0].http_status,204);assert.equal(rows[0].success,1);
});
