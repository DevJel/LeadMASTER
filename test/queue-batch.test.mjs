import { test } from 'node:test';
import assert from 'node:assert/strict';
import { consumeEmailBatch } from '../src/queue-batch.mjs';
function msg(id){return {body:{id},acked:0,retries:[],ack(){this.acked++},retry(x){this.retries.push(x)}}}
test('acks only terminal states and delays blocked and failed calls',async()=>{const statuses=['accepted','failed','unknown','id_conflict','blocked_unknown','network'];const messages=statuses.map(msg);await consumeEmailBatch({messages},{fetch:async(_,options)=>{const v=JSON.parse(options.body).id;if(v==='network')throw Error();return {ok:true,json:async()=>({status:v})}}});for(let i=0;i<4;i++)assert.equal(messages[i].acked,1);for(let i=4;i<6;i++){assert.equal(messages[i].acked,0);assert.deepEqual(messages[i].retries,[{delaySeconds:60}]);}});
test('retries non-success responses',async()=>{const m=msg('x');await consumeEmailBatch({messages:[m]},{fetch:async()=>({ok:false})});assert.equal(m.acked,0);assert.equal(m.retries.length,1)});
