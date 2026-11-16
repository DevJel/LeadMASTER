import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";
import { CUSTOMER_ERROR_GUIDE, mapLeadMasterError, SYSTEM_FALLBACK } from "../src/leadmaster-error-mapper.mjs";

test("customer guide contains distinct user-facing codes in all four categories",()=>{
  const categories=new Set(CUSTOMER_ERROR_GUIDE.map(x=>x.category));
  assert.deepEqual([...categories].sort(),["Account Handling","Connections & Sync","Email & Contacts","Limits"]);
  assert.equal(new Set(CUSTOMER_ERROR_GUIDE.map(x=>x.code)).size,CUSTOMER_ERROR_GUIDE.length);
  for(const item of CUSTOMER_ERROR_GUIDE){
    assert.match(item.code,/^LM-USR-\d{4}$/);
    assert.ok(item.title.length>4&&item.what.length>12&&item.steps.length>0);
  }
});

test("expired session maps to a plain-language customer error",()=>{
  const result=mapLeadMasterError(new Error("HTTP 401 Unauthorized: session expired"));
  assert.equal(result.code,"LM-USR-1002");
  assert.match(result.message,/sign in again|protection/i);
  assert.doesNotMatch(result.message,/401|HTTP|token|stack/i);
});

test("network and invalid email map to customer-friendly help codes",()=>{
  assert.equal(mapLeadMasterError(new Error("Failed to fetch")).code,"LM-USR-2002");
  assert.equal(mapLeadMasterError(new Error("invalid email address")).code,"LM-USR-3002");
});

test("unknown internal errors never leak technical details",()=>{
  const raw="SQL SELECT failed at /var/task/worker.js:43; SMTP password ***; HTTP 502";
  const result=mapLeadMasterError(new Error(raw));
  assert.equal(result.code,"342322");
  assert.equal(result.message,SYSTEM_FALLBACK);
  assert.doesNotMatch(result.message,/SQL|SELECT|worker\.js|SMTP|password|502|var\/task/i);
});

test("public Help Center lists every customer code and never includes internal mappings",async()=>{
  const html=await readFile(new URL("../public/help-center.html",import.meta.url),"utf8");
  const listed=[...new Set(html.match(/LM-USR-\\d{4}/g)||[])].sort();
  const source=CUSTOMER_ERROR_GUIDE.map(item=>item.code).sort();
  assert.deepEqual(listed,source);
  assert.doesNotMatch(html,/342\\d{3}|SQL|SMTP credentials|database query|stack trace/i);
  assert.match(html,/cs@leadmaster\\.jelvan\\.space/);
});
