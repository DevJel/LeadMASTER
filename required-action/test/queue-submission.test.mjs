import { test } from 'node:test';
import assert from 'node:assert/strict';
import { submitInOrder, writeBestEffort } from '../src/queue-submission.mjs';

test('submits in order and stops after an uncertain queue call', async () => {
 const calls=[];
 const result=await submitInOrder([
  async()=>calls.push(1),
  async()=>{calls.push(2); throw Error('connection lost after possible acceptance')},
  async()=>calls.push(3),
 ]);
 assert.deepEqual(calls,[1,2]);
 assert.deepEqual(result,{status:'submission_unconfirmed',confirmed:1});
});
test('first queue failure is uncertain, not proof that nothing was sent', async()=>{
 assert.deepEqual(await submitInOrder([async()=>{throw Error('timeout')}]),{status:'submission_unconfirmed',confirmed:0});
});
test('successful batches remain queued despite later activity or notification errors', async()=>{
 const result=await submitInOrder([async()=>{},async()=>{}]); let secondWrite=false;
 await writeBestEffort([async()=>{throw Error('activity DB down')},async()=>{secondWrite=true;throw Error('notification DB down')}]);
 assert.deepEqual(result,{status:'queued',confirmed:2}); assert.equal(secondWrite,true);
});
