import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validSuppressionEmail } from '../src/suppression-validation.mjs';

test('accepts ordinary normalized addresses for suppression', () => {
  for (const email of ['someone@example.com', 'first.last+tag@example.co.uk', 'user-1@sample.org']) assert.equal(validSuppressionEmail(email), true, email);
});
test('rejects malformed, whitespace, control, and oversized input', () => {
  for (const email of ['', 'not-an-email', 'no@dot', 'a@@example.com', 'a b@example.com', 'a@b..com', 'a@example.com\nX: y', 'x'.repeat(250)+'@example.com', null]) assert.equal(validSuppressionEmail(email), false, String(email));
});
test('suppression route invokes the tested validation function', async () => {
 const worker=await readFile(new URL('../worker.js',import.meta.url),'utf8');
 assert.match(worker,/if\(!validSuppressionEmail\(email\)\)return json/);
});
