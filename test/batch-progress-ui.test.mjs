import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL(p,import.meta.url),'utf8');
test('outbox and composer use persisted production send queue results',async()=>{
 const app=await read('../required-componets-design/App.tsx');
 assert.match(app,/api\/admin\/send/);
 assert.match(app,/queue_status/);
 assert.match(app,/delivery_status/);
 assert.match(app,/Queued/);
 assert.match(app,/Failed/);
 assert.match(app,/Queue acceptance is not delivery confirmation/);
 assert.doesNotMatch(app,/async function resendOutbox/);
 assert.doesNotMatch(app,/async function sendAllNow/);
 assert.match(app,/Unknown outcomes must be reconciled/);
});
