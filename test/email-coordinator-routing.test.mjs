import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('production administrator email sends use the coordinator without a direct SMTP bypass', async()=>{
  const worker=await readFile(new URL('../worker.js',import.meta.url),'utf8');
  assert.equal(worker.includes('sendSesEmail('),false);
  assert.equal(worker.includes('import { connect } from "cloudflare:sockets";'),false);
  assert.equal((worker.match(/sendThroughEmailCoordinator\(env/g)||[]).length,2);
  assert.ok(worker.includes('export { EmailCoordinator }'));
});

test('production queue consumer routes messages through the same coordinator binding',async()=>{
  const source=await readFile(new URL('../workers/mail-queue-consumer.js',import.meta.url),'utf8');
  assert.ok(source.includes('sendThroughEmailCoordinator(options.env, options)'));
  assert.equal(source.includes('sendSesEmail'),false);
  assert.equal(source.includes('cloudflare:sockets'),false);
});
