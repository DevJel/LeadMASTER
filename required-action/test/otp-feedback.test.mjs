import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const worker=await readFile(new URL('../worker.js',import.meta.url),'utf8');
const login=await readFile(new URL('../public/login.js',import.meta.url),'utf8');

test('primary administrator login is not blocked by IP or email throttles',()=>{
  assert.doesNotMatch(worker,/rateLimit\(env,\s*["'](?:ip:|email:|verify-ip:)/);
  assert.doesNotMatch(worker,/emailLimit/);
  assert.match(worker,/verifyLoginTurnstile/);
  assert.match(worker,/configuredAdminEmail/);
  assert.match(worker,/row\.attempts >= 5/);
});

test('OTP verification distinguishes invalid, expired, locked and network failure cases',()=>{
  assert.match(worker,/This code has expired/);
  assert.match(worker,/Too many incorrect codes/);
  assert.match(worker,/does not match the latest email/);
  assert.match(login,/typeof body\.error==='string'\?body\.error/);
  assert.match(login,/request timed out/);
  assert.match(login,/latest code/);
});
