import { test } from 'node:test';
import assert from 'node:assert/strict';
import { developerEmailRoute } from '../src/developer-api.mjs';
const key='lm_live_'+'A'.repeat(43), acct='account-test', idem='request_test_123456';
const keyHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key))),x=>x.toString(16).padStart(2,'0')).join('');
function setup({queueThrows=false,activityThrows=false,queuePresent=true}={}){
 let record, queueCalls=0, activityCalls=0; const writes=[];
 const db={prepare(sql){let args=[]; return {bind(...v){args=v;return this},async first(){
  if(sql.includes('FROM developer_api_keys')) return {id:'key1',key_hash:keyHash,scopes:'["email:send"]',revoked_at:null,account_id:acct,created_by:'owner@example.test'};
  if(sql.includes('auth_rate_limits'))return {count:1};
  if(sql.includes('FROM developer_email_requests'))return record||null;
  if(sql.includes('FROM email_unsubscribes'))return null;
  if(sql.includes('FROM accounts'))return {name:'Example',owner_email:'owner@example.test',owner_name:'Owner'};
  throw Error('unexpected query: '+sql);
 },async run(){writes.push(sql);
  if(sql.startsWith('INSERT INTO developer_email_requests'))record={id:args[0],status:'sending',created_at:args[5]};
  if(sql.startsWith('UPDATE developer_email_requests SET status='))record.status='failed';
  if(sql.startsWith('INSERT INTO workspace_activity')){activityCalls++; if(activityThrows)throw Error('activity unavailable');}
  return {meta:{changes:1}};
 }}}};
 const queue={send:async()=>{queueCalls++;if(queueThrows)throw Error('timeout after possible acceptance')}};
 return {env:{AUTH_DB:db,...(queuePresent?{MAIL_SEND_QUEUE:queue}:{})},get record(){return record},get queueCalls(){return queueCalls},get activityCalls(){return activityCalls},writes};
}
function request(){return new Request('https://example.test/api/v1/accounts/account-test/emails',{method:'POST',headers:{authorization:'Bearer '+key,'content-type':'application/json','idempotency-key':idem},body:JSON.stringify({to:'recipient@example.test',subject:'Hello',text:'Body'})});}
test('uncertain queue acceptance preserves sending state and replay cannot enqueue a second time',async()=>{
 const s=setup({queueThrows:true}); let r=await developerEmailRoute(request(),s.env,null,acct); const body=await r.json();
 assert.equal(r.status,503);assert.equal(body.status,'submission_unconfirmed');assert.match(body.error,/Do not submit a new request/);assert.equal(s.record.status,'sending');
 r=await developerEmailRoute(request(),s.env,null,acct);assert.equal((await r.json()).replayed,true);assert.equal(s.queueCalls,1);
});
test('activity failure after successful enqueue still reports queued',async()=>{
 const s=setup({activityThrows:true});const r=await developerEmailRoute(request(),s.env,null,acct);
 assert.equal(r.status,202);assert.equal((await r.json()).status,'queued');assert.equal(s.record.status,'sending');assert.equal(s.queueCalls,1);assert.equal(s.activityCalls,1);
});
test('missing queue records definite failure without attempting a send',async()=>{
 const s=setup({queuePresent:false});const r=await developerEmailRoute(request(),s.env,null,acct);
 assert.equal(r.status,503);assert.equal((await r.json()).status,'failed');assert.equal(s.record.status,'failed');assert.equal(s.queueCalls,0);
});
