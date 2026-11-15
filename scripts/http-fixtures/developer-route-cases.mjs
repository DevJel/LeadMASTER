import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../../worker.js';
const origin='https://synthetic.invalid', email='admin@example.test';
globalThis.fetch=async()=>new Response('SYNTHETIC UPSTREAM',{status:404});

// Exercise the account email endpoint through the actual Worker router. All
// credentials, account identifiers, database responses and queue calls are synthetic.
test('account email route enforces key ownership before enqueueing',async()=>{
 const accountA='acct_AAAAAAAAAAAAAAAAAAAAAA',accountB='acct_BBBBBBBBBBBBBBBBBBBBBB';
 const key='lm_live_'+'A'.repeat(43);
 const keyHash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key))).toString('hex');
 let queued=0;
 function fakeEnv(keyAccount=accountA){return {AUTH_DB:{prepare(sql){return {bind(){return this},async first(){
   if(sql.includes('FROM developer_api_keys'))return {id:'key',key_hash:keyHash,scopes:'["email:send"]',revoked_at:null,account_id:keyAccount,created_by:email};
   if(sql.includes('auth_rate_limits'))return {count:1};
   if(sql.includes('FROM developer_email_requests')||sql.includes('FROM email_unsubscribes'))return null;
   if(sql.includes('FROM accounts'))return {name:'Test',owner_email:email,owner_name:'Test Owner'};
   throw Error('unexpected query: '+sql);
 },async run(){return {meta:{changes:1}}}}}},MAIL_SEND_QUEUE:{async send(){queued++}}}}
 function request(auth){return new Request(origin+'/api/v1/accounts/'+accountA+'/emails',{method:'POST',headers:{...(auth?{authorization:'Bearer '+key}:{}),'content-type':'application/json','idempotency-key':'request_test_123456'},body:JSON.stringify({to:'person@example.test',subject:'Hi',text:'Hello'})})}
 let r=await worker.fetch(request(false),fakeEnv(),{});assert.equal(r.status,401);assert.equal(queued,0);
 r=await worker.fetch(request(true),fakeEnv(accountB),{});assert.equal(r.status,404);assert.equal(queued,0);
 r=await worker.fetch(request(true),fakeEnv(),{});assert.equal(r.status,202);assert.equal((await r.json()).status,'queued');assert.equal(queued,1);
});
