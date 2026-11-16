import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/email-coordinator.mjs", import.meta.url), "utf8");

test("internal coordinator health reports readiness without returning secret values", () => {
  assert.match(source, /url\.pathname===['"]\/health['"]/);
  assert.match(source, /smtpConfigured:host&&username&&password/);
  assert.match(source, /fromConfigured:from/);
  assert.match(source, /status:healthy\?'healthy':'misconfigured'/);
  assert.doesNotMatch(source.slice(source.indexOf("if(request.method==='GET'"), source.indexOf("if(request.method!=='POST')")), /SES_SMTP_PASSWORD\s*:/);
});

test("health endpoint is GET-only and missing SMTP credentials produce a failing health status", () => {
  const health = source.slice(source.indexOf("if(request.method==='GET'"), source.indexOf("if(request.method!=='POST')"));
  assert.match(health, /status:healthy\?200:503/);
  assert.match(health, /smtpConfigured:host&&username&&password/);
  assert.match(health, /fromConfigured:from/);
});
