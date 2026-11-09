import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EmailDispatchCore, enqueueEmail } from '../src/email-queue-core.mjs';

class Storage {
  constructor(){this.map=new Map();}
  async get(key){return this.map.get(key);}
  async put(key,value){this.map.set(key,value);}
  async delete(key){this.map.delete(key);}
  async transaction(fn){
    const before=new Map(this.map);
    try{return await fn(this);}
    catch(error){this.map=before;throw error;}
  }
}
const job=n=>({id:`job_${n}`,to:'recipient@example.com',subject:'Hello',text:'Message'});

test('serializes concurrent jobs and keeps starts at least 101 ms apart',async()=>{
  const storage=new Storage(); let now=1000; const starts=[]; let active=0,maxActive=0;
  const core=new EmailDispatchCore({
    storage,clock:()=>now,sleep:async ms=>{now+=ms;},
    send:async()=>{active++;maxActive=Math.max(maxActive,active);starts.push(now);now+=10;active--;return {status:'accepted'};}
  });
  const results=await Promise.all(Array.from({length:25},(_,i)=>core.dispatch(job(i))));
  assert.ok(results.every(result=>result.status==='accepted'));
  assert.equal(maxActive,1); assert.equal(starts.length,25);
  for(let i=1;i<starts.length;i++) assert.ok(starts[i]-starts[i-1]>=101);
  for(const start of starts) assert.ok(starts.filter(value=>value>=start && value<start+1000).length<=10);
});

test('accepted idempotent duplicate does not resend; altered duplicate conflicts',async()=>{
  let sends=0;
  const core=new EmailDispatchCore({storage:new Storage(),send:async()=>{sends++;return {status:'accepted'};}});
  assert.equal((await core.dispatch(job(1))).status,'accepted');
  assert.equal((await core.dispatch(job(1))).status,'accepted');
  assert.equal((await core.dispatch({...job(1),text:'changed'})).status,'id_conflict');
  assert.equal(sends,1);
});

test('ambiguous result fences only its own ID and does not block later messages',async()=>{
  const storage=new Storage(); let sends=0;
  const core=new EmailDispatchCore({storage,send:async()=>{
    sends++;
    if(sends===1){const error=Error('ambiguous');error.deliveryOutcome='unknown';throw error;}
    return {status:'accepted'};
  }});
  assert.equal((await core.dispatch(job(1))).status,'unknown');
  assert.equal((await core.dispatch(job(1))).status,'blocked_unknown');
  assert.equal((await core.dispatch(job(2))).status,'accepted');
  const afterRestart=new EmailDispatchCore({storage,send:async()=>{sends++;return {status:'accepted'};}});
  assert.equal((await afterRestart.dispatch(job(1))).status,'blocked_unknown');
  assert.equal((await afterRestart.dispatch(job(2))).status,'accepted');
  assert.equal(sends,2);
});

test('persisted in-flight job is not retried, but new IDs can proceed',async()=>{
  const storage=new Storage();
  const first=new EmailDispatchCore({storage,send:async()=>{const error=Error();error.deliveryOutcome='unknown';throw error;}});
  assert.equal((await first.dispatch(job(1))).status,'unknown');
  let sends=0;
  const restarted=new EmailDispatchCore({storage,send:async()=>{sends++;return {status:'accepted'};}});
  assert.equal((await restarted.dispatch(job(1))).status,'blocked_unknown');
  assert.equal((await restarted.dispatch(job(2))).status,'accepted');
  assert.equal(sends,1);
});

test('definite pre-DATA failure is recorded and not retried automatically',async()=>{
  let sends=0;
  const core=new EmailDispatchCore({storage:new Storage(),send:async()=>{
    sends++;const error=Error();error.deliveryOutcome='not_accepted';throw error;
  }});
  assert.equal((await core.dispatch(job(1))).status,'failed');
  assert.equal((await core.dispatch(job(1))).status,'failed');
  assert.equal(sends,1);
});

test('persistent rate reservation fails closed when clock moves backwards',async()=>{
  const storage=new Storage(); let now=50000;
  const core=new EmailDispatchCore({storage,clock:()=>now,send:async()=>({status:'accepted'})});
  assert.equal((await core.dispatch(job(1))).status,'accepted');
  now=1000;
  assert.equal((await core.dispatch(job(2))).status,'blocked_clock');
});

test('invalid identities, optional sender fields and rates are rejected',async()=>{
  const core=new EmailDispatchCore({storage:new Storage(),send:async()=>({status:'accepted'})});
  await assert.rejects(core.dispatch({...job(1),to:'bad\r\nDATA'}));
  await assert.rejects(core.dispatch({...job(2),fromEmail:'bad\r\n@example.com'}));
  await assert.rejects(core.dispatch({...job(3),replyTo:'bad@example.com\r\nBcc:x'}));
  assert.throws(()=>new EmailDispatchCore({storage:new Storage(),send:async()=>({status:'accepted'}),ratePerSecond:11}));
});

test('trusted enqueue sends only normalized message content',async()=>{
  let posted;
  const result=await enqueueEmail({send:async value=>{posted=value;}},{...job(1),ignored:'unused'});
  assert.deepEqual(result,{status:'queued'});
  assert.deepEqual(posted,job(1));
  await assert.rejects(enqueueEmail({send:async()=>{}},{...job(1),text:'x'.repeat(200001)}));
});

test('rolling daily quota reserves before sending and defers excess until expiry',async()=>{
  const storage=new Storage();let now=100000000;let sends=0;
  const core=new EmailDispatchCore({storage,clock:()=>now,sleep:async ms=>{now+=ms;},maxPer24h:2,send:async()=>{sends++;return {status:'accepted'};}});
  assert.equal((await core.dispatch(job(1))).status,'accepted');
  assert.equal((await core.dispatch(job(2))).status,'accepted');
  assert.equal((await core.dispatch(job(3))).status,'deferred_quota');
  assert.equal(sends,2);
  now+=86400000+60000;
  assert.equal((await core.dispatch(job(3))).status,'accepted');
  assert.equal(sends,3);
});

test('failed attempts consume daily quota; corrupt quota state fails closed',async()=>{
  const storage=new Storage();let now=100000000;
  const core=new EmailDispatchCore({storage,clock:()=>now,sleep:async ms=>{now+=ms;},maxPer24h:1,send:async()=>{
    const error=Error();error.deliveryOutcome='not_accepted';throw error;
  }});
  assert.equal((await core.dispatch(job(1))).status,'failed');
  assert.equal((await core.dispatch(job(2))).status,'deferred_quota');
  const broken=new Storage();await broken.put('quota_window',{last:1,buckets:[[1,-1]]});
  let sends=0;
  const failClosed=new EmailDispatchCore({storage:broken,send:async()=>{sends++;return {status:'accepted'};}});
  await assert.rejects(failClosed.dispatch(job(4)));
  assert.equal(sends,0);
});

test('HTML and sender metadata are passed through and included in idempotency identity',async()=>{
  const storage=new Storage();const sent=[];
  const core=new EmailDispatchCore({storage,send:async value=>{sent.push(value);return {status:'accepted'};}});
  const first={...job(1),html:'<b>First</b>',fromEmail:'sender@example.com',fromName:'LeadMASTER',replyTo:'reply@example.com',messageId:'123e4567-e89b-12d3-a456-426614174000'};
  assert.equal((await core.dispatch(first)).status,'accepted');
  assert.equal(sent[0].html,first.html);
  assert.equal(sent[0].fromEmail,first.fromEmail);
  assert.equal((await core.dispatch({...first,fromName:'Changed'})).status,'id_conflict');
});
