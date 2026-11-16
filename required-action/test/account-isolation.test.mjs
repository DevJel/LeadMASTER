import test from "node:test";
import assert from "node:assert/strict";
import { developerEmailRoute, developerEmailStatus, developerAccountInfo, developerAdminRoute } from "../src/developer-api.mjs";
import { webhookRoute, adminWebhookRoute } from "../src/developer-webhooks.mjs";

const accountA="acct_AAAAAAAAAAAAAAAAAAAAAA";
const accountB="acct_BBBBBBBBBBBBBBBBBBBBBB";
const token="lm_live_"+ "A".repeat(43);
const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,"0")).join("");
function dbWithKey(accountId){
 const key={id:"key-1",key_hash:null,scopes:JSON.stringify(["email:send","email:read","webhook:manage"]),revoked_at:null,account_id:accountId};
 return {prepare(sql){return {bind(){return this},async first(){if(sql.includes("FROM developer_api_keys"))return {...key,key_hash:await hash(token)};return null},async all(){return {results:[]}},async run(){return {meta:{changes:0}}}}}};
}
const request=(path,method="GET")=>new Request("https://leadmaster.jelvan.pro"+path,{method,headers:{authorization:"Bearer "+token,"content-type":"application/json"}});
test("email send endpoint rejects a valid key from a different account before processing",async()=>{
 const env={AUTH_DB:dbWithKey(accountB)};
 const response=await developerEmailRoute(request("/api/v1/accounts/"+accountA+"/emails","POST"),env,()=>{throw Error("must not send")},accountA);
 assert.equal(response.status,404);
});
test("email status endpoint rejects cross-account key use",async()=>{
 const env={AUTH_DB:dbWithKey(accountB)};
 const response=await developerEmailStatus(request("/api/v1/accounts/"+accountA+"/emails/12345678-1234-1234-1234-123456789012"),env,accountA);
 assert.equal(response.status,401);
});
test("account info endpoint does not disclose another account",async()=>{
 const env={AUTH_DB:dbWithKey(accountB)};
 const response=await developerAccountInfo(request("/api/v1/accounts/"+accountA),env,accountA);
 assert.equal(response.status,401);
});
test("webhook endpoint rejects a valid key from a different account",async()=>{
 const env={AUTH_DB:dbWithKey(accountB)};
 const response=await webhookRoute(request("/api/v1/accounts/"+accountA+"/webhooks"),env,accountA);
 assert.equal(response.status,404);
});
test("API key listing query is scoped to the signed-in account",async()=>{
 let bound;
 const env={AUTH_DB:{prepare(sql){return {bind(value){bound={sql,value};return this},async all(){return {results:[]}}}}}};
 const response=await developerAdminRoute(new Request("https://leadmaster.jelvan.pro/api/developer/keys"),env,{email:"owner@example.test",accountId:accountA});
 assert.equal(response.status,200);
 assert.equal(bound.value,accountA);
 assert.match(bound.sql,/WHERE account_id=\?/);
});


test("dashboard webhook listing is restricted to the authenticated account and omits secrets",async()=>{
 let bound;
 const env={AUTH_DB:{prepare(sql){return {bind(value){bound={sql,value};return this},async all(){return {results:[{id:"hook-1",name:"Production",target_url:"https://hooks.example.com/lm",events:'["email.accepted"]',created_at:1,revoked_at:null,last_delivery_at:null,api_key_id:"key-1",api_key_name:"Production API",key_prefix:"lm_live_123"}]}}}}}};
 const response=await adminWebhookRoute(new Request("https://leadmaster.jelvan.pro/api/admin/webhooks"),env,{email:"owner@example.test",accountId:accountA});
 assert.equal(response.status,200);
 assert.equal(bound.value,accountA);
 assert.match(bound.sql,/WHERE w\.account_id=\?/);
 const data=await response.json();
 assert.equal(data.webhooks[0].events[0],"email.accepted");
 assert.equal("signing_secret" in data.webhooks[0],false);
 assert.equal("secret_value" in data.webhooks[0],false);
});
