import test from "node:test";
import assert from "node:assert/strict";
import { webhookRoute, adminWebhookRoute, deliverWebhookEvent } from "../src/developer-webhooks.mjs";
import { developerAdminRoute, developerEmailRoute } from "../src/developer-api.mjs";

const account="acct_test", keyId="12345678-1234-1234-1234-123456789012", token="lm_live_"+"A".repeat(43);
const session={accountId:account,email:"owner@example.test"};
const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value))),v=>v.toString(16).padStart(2,"0")).join("");
function fixture(){
 const writes=[],hooks=[];
 const db={prepare(sql){return {values:[],bind(...values){this.values=values;return this},async first(){
  if(sql.includes("FROM developer_api_keys"))return {id:keyId,key_hash:await digest(token),scopes:JSON.stringify(["webhook:manage","email:send"]),revoked_at:null,account_id:account};
  throw Error("Unexpected read: "+sql);
 },async all(){if(sql.includes("FROM developer_webhooks"))return {results:hooks};throw Error("Unexpected list: "+sql)},async run(){writes.push({sql,values:this.values});if(sql.startsWith("INSERT INTO developer_webhooks "))hooks.push({id:this.values[0],api_key_id:this.values[1],target_url:this.values[3],secret_value:this.values[5]});return {meta:{changes:1}}}}}};
 return {env:{AUTH_DB:db,SESSION_SECRET:"test-only-encryption-key"},writes,hooks};
}
function request(path,body,options={}){
 const headers={"content-type":"application/json",origin:"https://leadmaster.example.com",authorization:"Bearer "+token,...options.headers};
 return new Request("https://leadmaster.example.com"+path,{method:"POST",headers,body:typeof body==="string"?body:JSON.stringify(body)});
}
const payload=url=>({name:"Production",url,events:["email.accepted"],api_key_id:keyId});
const paths={admin:"/api/admin/webhooks",bearer:"/api/v1/accounts/"+account+"/webhooks"};
async function create(kind,env,body){const req=request(paths[kind],body);return kind==="admin"?adminWebhookRoute(req,env,session):webhookRoute(req,env,account)}
for(const kind of ["admin","bearer"]){
 test(`${kind}: rejects local and invalid callback URL spellings`,async()=>{
  const {env,writes}=fixture();
  for(const url of ["https://x.localhost", "https://x.localhost.","https://x.internal.","https://x.test.","https://127.1/", "https://0x7f000001/", "https://[::1]/", "https://user:pass@hooks.acme.com/", "http://hooks.acme.com", "https://hooks.acme.com:8443", "https://a..acme.com", "https://hooks.acme.com/"+"a".repeat(2049)]){
   const response=await create(kind,env,payload(url));assert.equal(response.status,400,url);
  }
  assert.equal(writes.length,0);
 });
 test(`${kind}: accepts valid HTTPS webhook and caps JSON input`,async()=>{
  const {env,writes}=fixture();
  assert.equal((await create(kind,env,payload("https://hooks.acme.com/events"))).status,201);
  const before=writes.length;
  assert.equal((await create(kind,env,{...payload("https://hooks.acme.com"),padding:"x".repeat(9000)})).status,400);
  assert.equal(writes.length,before);
 });
}
test("invalid existing webhook is not fetched and its failed attempt is account scoped",async()=>{
 const {env,hooks,writes}=fixture();
 assert.equal((await create("bearer",env,payload("https://hooks.acme.com/events"))).status,201);
 hooks[0].target_url="https://a.localhost.";
 const original=globalThis.fetch;let called=false;globalThis.fetch=async()=>{called=true;throw Error("must not fetch")};
 try{await deliverWebhookEvent(env,"email.accepted",{id:"test"},keyId,account)}finally{globalThis.fetch=original}
 assert.equal(called,false);
 const delivery=writes.find(w=>w.sql.startsWith("INSERT INTO developer_webhook_deliveries"));
 assert.equal(delivery.values[4],null);assert.equal(delivery.values[6],0);
 const update=writes.find(w=>w.sql.startsWith("UPDATE developer_webhooks SET last_delivery_at"));
 assert.match(update.sql,/api_key_id=\? AND account_id=\?/);assert.deepEqual(update.values.slice(-2),[keyId,account]);
});
test("valid webhook dispatch still signs and records delivery",async()=>{
 const {env,writes}=fixture();assert.equal((await create("bearer",env,payload("https://hooks.acme.com/events"))).status,201);
 const original=globalThis.fetch;let called;
 globalThis.fetch=async(url,init)=>{called={url,init};return new Response("",{status:200})};
 try{await deliverWebhookEvent(env,"email.accepted",{id:"test"},keyId,account)}finally{globalThis.fetch=original}
 assert.equal(called.url,"https://hooks.acme.com/events");assert.equal(called.init.redirect,"manual");assert.match(called.init.headers["leadmaster-signature"],/^v1=[0-9a-f]{64}$/);
 assert.equal(writes.find(w=>w.sql.startsWith("INSERT INTO developer_webhook_deliveries")).values[6],1);
});
test("developer key and email endpoints reject over-limit request streams before writes",async()=>{
 const {env,writes}=fixture();
 let res=await developerAdminRoute(request("/api/developer/keys",{name:"x".repeat(5000)}),env,session);assert.equal(res.status,400);
 res=await developerEmailRoute(request("/api/v1/accounts/"+account+"/emails",{padding:"x".repeat(250001)},{headers:{"idempotency-key":"a".repeat(16)}}),env,()=>{throw Error("must not send")},account);assert.equal(res.status,400);assert.equal(writes.length,0);
});
test("webhook rejects missing JSON content type before writing",async()=>{
 const {env,writes}=fixture();const req=request(paths.admin,payload("https://hooks.acme.com"),{headers:{"content-type":"text/plain"}});
 assert.equal((await adminWebhookRoute(req,env,session)).status,400);assert.equal(writes.length,0);
});
test("webhook rejects a chunked body that exceeds the byte limit without a length header",async()=>{
 const {env,writes}=fixture();let cancelled=false;
 const stream=new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('{"padding":"'));controller.enqueue(new Uint8Array(8192).fill(120));},cancel(){cancelled=true}});
 const req=new Request("https://leadmaster.example.com"+paths.admin,{method:"POST",duplex:"half",headers:{"content-type":"application/json",origin:"https://leadmaster.example.com"},body:stream});
 assert.equal((await adminWebhookRoute(req,env,session)).status,400);assert.equal(cancelled,true);assert.equal(writes.length,0);
});
