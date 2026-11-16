import test from 'node:test';
import assert from 'node:assert/strict';
import {readAuthDependency} from '../src/auth-read-retry.mjs';

test('temporary read exceptions and empty dependency values are retried',async()=>{
 let count=0;
 const result=await readAuthDependency(()=>{count++;if(count===1)throw Error('temporary');if(count===2)return null;return 'synthetic';},{deadline:Date.now()+1000,accept:Boolean,delays:[0,0]});
 assert.equal(result,'synthetic');assert.equal(count,3);
});
test('absent records are definitive and not retried',async()=>{
 let count=0;assert.equal(await readAuthDependency(()=>{count++;return null},{deadline:Date.now()+1000,delays:[0,0]}),null);assert.equal(count,1);
});
test('stalled reads time out and overall wait is bounded',async()=>{
 const start=Date.now();let count=0;
 await assert.rejects(readAuthDependency(()=>{count++;return new Promise(()=>{})},{deadline:start+60,perAttemptMs:15,delays:[0,0]}));
 assert.ok(Date.now()-start<250);assert.ok(count<=3);
});
