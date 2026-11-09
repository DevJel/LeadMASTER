import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const worker=await readFile(new URL('../worker.js',import.meta.url),'utf8');
const login=await readFile(new URL('../public/login.js',import.meta.url),'utf8');

test('authentication rate limits return a retry window instead of a misleading credential error',()=>{
  assert.match(worker,/RETURNING count, window_start/);
  assert.match(worker,/emailLimit\.allowed/);
  assert.match(worker,/Too many sign-in requests for this account/);
  assert.match(worker,/retry-after/);
});

test('OTP verification distinguishes invalid, expired, locked and network failure cases',()=>{
  assert.match(worker,/This code has expired/);
  assert.match(worker,/Too many incorrect codes/);
  assert.match(worker,/does not match the latest email/);
  assert.match(login,/typeof body\.error==='string'\?body\.error/);
  assert.match(login,/request timed out/);
  assert.match(login,/latest code/);
});
