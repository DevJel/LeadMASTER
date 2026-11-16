import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {recordSmtpQueued,transitionSmtpActivity,listSmtpActivity} from '../src/external-smtp-activity.mjs';
const accountId='acct_'+'A'.repeat(22),other='acct_'+'B'.repeat(22),connectionId='11111111-1111-4111-8111-111111111111',otherConnection='22222222-2222-4222-8222-222222222222';
const msg=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
function setup(){const sql=new DatabaseSync(':memory:');sql.exec(readFileSync(new URL('../migrations/0016_external_smtp_activity.sql',import.meta.url),'utf8'));return {prepare(query){let args=[];return {bind(...v){args=v;return this},async all(){return {results:sql.prepare(query).all(...args)}},async run(){return {meta:{changes:Number(sql.prepare(query).run(...args).changes)}}}}}}}
test('scopes monitoring and transitions to both account and sender',async()=>{
 const db=setup(),messageId=msg(1);assert.equal(await recordSmtpQueued(db,{accountId,connectionId,messageId,at:10}),true);
 assert.equal(await transitionSmtpActivity(db,{accountId:other,connectionId,messageId,from:'queued',to:'accepted',at:11}),false);
 assert.equal(await transitionSmtpActivity(db,{accountId,connectionId:otherConnection,messageId,from:'queued',to:'failed',at:11}),false);
 assert.deepEqual((await listSmtpActivity(db,{accountId:other,connectionId})).items,[]);
 assert.deepEqual((await listSmtpActivity(db,{accountId,connectionId:otherConnection})).items,[]);
 assert.equal((await listSmtpActivity(db,{accountId,connectionId})).counts.queued,1);
});
test('queue entries are idempotent, sender attribution cannot change and transitions are monotonic',async()=>{
 const db=setup(),messageId=msg(1),base={accountId,connectionId,messageId};
 assert.equal(await recordSmtpQueued(db,{...base,at:10}),true);assert.equal(await recordSmtpQueued(db,{...base,at:11}),false);
 assert.equal(await recordSmtpQueued(db,{...base,connectionId:otherConnection,at:12}),false);
 assert.equal(await transitionSmtpActivity(db,{...base,from:'queued',to:'unknown',at:20}),true);
 assert.equal(await transitionSmtpActivity(db,{...base,from:'queued',to:'failed',at:21}),false);
 assert.equal(await transitionSmtpActivity(db,{...base,from:'unknown',to:'accepted',at:19}),false);
 assert.equal(await transitionSmtpActivity(db,{...base,from:'unknown',to:'accepted',at:21}),true);
 const out=await listSmtpActivity(db,{accountId,connectionId});assert.deepEqual(out.counts,{queued:0,accepted:1,failed:0,unknown:0});assert.deepEqual(Object.keys(out.items[0]).sort(),['created_at','message_id','status','updated_at']);
 await assert.rejects(transitionSmtpActivity(db,{...base,from:'accepted',to:'queued',at:22}),TypeError);
});
test('pagination has deterministic ordering even when timestamps tie',async()=>{
 const db=setup();for(let n=1;n<=5;n++)await recordSmtpQueued(db,{accountId,connectionId,messageId:msg(n),at:10});
 const p1=await listSmtpActivity(db,{accountId,connectionId,limit:2});const p2=await listSmtpActivity(db,{accountId,connectionId,limit:2,before:p1.next});const p3=await listSmtpActivity(db,{accountId,connectionId,limit:2,before:p2.next});
 assert.deepEqual([...p1.items,...p2.items,...p3.items].map(x=>x.message_id),[5,4,3,2,1].map(msg));assert.equal(p3.next,null);assert.equal(p3.counts.queued,5);
});
test('rejects malformed identifiers, times, states and unbounded pages',async()=>{
 const db=setup();await assert.rejects(recordSmtpQueued(db,{accountId,connectionId,messageId:'x',at:1}),TypeError);await assert.rejects(recordSmtpQueued(db,{accountId,connectionId,messageId:msg(1),at:-1}),TypeError);await assert.rejects(listSmtpActivity(db,{accountId,connectionId,limit:101}),TypeError);await assert.rejects(listSmtpActivity(db,{accountId,connectionId,before:{createdAt:0,messageId:'x'}}),TypeError);
});
