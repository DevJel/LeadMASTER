/**
 * Single-coordinator SES dispatch core. The platform adapter must serialize
 * every LeadMASTER sender through the same Durable Object identity.
 * No public HTTP endpoint or producer authorization is implemented here.
 */
const encoder = new TextEncoder();
const MAX_ID = 128;
const ID = /^[A-Za-z0-9_-]{1,128}$/;
const EMAIL = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/;
const defaultSleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export function validateEmailJob(job) {
  if (!job || typeof job !== 'object' || Array.isArray(job) || typeof job.id !== 'string' || job.id.length > MAX_ID || !ID.test(job.id) || typeof job.to !== 'string' || job.to.length > 254 || !EMAIL.test(job.to) || job.to.includes('..') || typeof job.subject !== 'string' || !job.subject.trim() || /[\r\n\x00-\x1f\x7f]/.test(job.subject) || encoder.encode(job.subject).length > 300 || typeof job.text !== 'string' || !job.text.trim() || encoder.encode(job.text).length > 200000) throw new TypeError('Invalid queued message');
}
/** Trusted server-side callers must authenticate/authorize before enqueueing. */
export async function enqueueEmail(queue, job) {
  validateEmailJob(job);
  if (!queue || typeof queue.send !== 'function') throw new TypeError('Queue unavailable');
  const message = {id:job.id,to:job.to,subject:job.subject,text:job.text};
  if (encoder.encode(JSON.stringify(message)).length > 100000) throw new TypeError('Queued message too large');
  await queue.send(message);
  return {status:'queued'};
}
async function digest(job) {
  const input = encoder.encode(JSON.stringify([job.to,job.subject,job.text]));
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256',input));
  return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
}
/** Storage must provide get() and atomic transaction() as Cloudflare DO storage does. */
export class EmailDispatchCore {
  constructor({ storage, send, clock = Date.now, sleep = defaultSleep, ratePerSecond = 10 }) {
    if (!storage || typeof storage.transaction !== 'function' || typeof send !== 'function' || !Number.isInteger(ratePerSecond) || ratePerSecond < 1 || ratePerSecond > 10) throw new TypeError('Invalid dispatch configuration');
    this.storage=storage;this.send=send;this.clock=clock;this.sleep=sleep;this.interval=Math.floor(1000/ratePerSecond)+1;this.tail=Promise.resolve();
  }
  dispatch(job) {
    // A single promise chain serializes active requests inside this instance.
    const next=this.tail.then(()=>this.run(job));this.tail=next.catch(()=>{});return next;
  }
  async run(job) {
    validateEmailJob(job);const hash=await digest(job), key=`job:${job.id}`;
    const prior=await this.storage.get(key);
    if (prior && prior.hash!==hash) return {status:'id_conflict'};
    if (prior?.status==='accepted' || prior?.status==='failed') return {status:prior.status};
    if (prior && !['accepted','failed'].includes(prior.status)) return {status:'blocked_unknown'};
    // An unresolved in-flight record survives crashes; never resume dispatch
    // automatically because SES may have accepted the previous DATA command.
    if (await this.storage.get('active')) return {status:'blocked_unknown'};
    let now=this.clock(), last=await this.storage.get('last_end');
    if (!Number.isFinite(now) || (last!==undefined && !Number.isFinite(last))) throw Error('Clock state unavailable');
    if (last!==undefined) {
      let delay=last+this.interval-now;
      // A backwards or badly shifted clock must fail closed, not release a burst.
      if (delay>30000) return {status:'blocked_clock'};
      if (delay>0) { await this.sleep(delay); now=this.clock(); if (!Number.isFinite(now) || now<last+this.interval) return {status:'blocked_clock'}; }
    }
    await this.storage.transaction(async tx=>{
      // Persistent intent precedes every external side effect.
      if (await tx.get('active')) throw Error('Dispatch blocked');
      await tx.put(key,{hash,status:'sending'});await tx.put('active',{id:job.id});
    });
    let outcome;
    try {
      const result=await this.send({to:job.to,subject:job.subject,text:job.text});
      outcome=result?.status==='accepted'?'accepted':'unknown';
    } catch(e) {outcome=e?.deliveryOutcome==='not_accepted'?'failed':'unknown';}
    const end=this.clock();
    if (!Number.isFinite(end) || end<now) outcome='unknown';
    if(outcome==='unknown') {
      // Keep active set: later work must pause until the outcome is reconciled.
      await this.storage.put(key,{hash,status:'unknown'});
      return {status:'unknown'};
    }
    await this.storage.transaction(async tx=>{await tx.put(key,{hash,status:outcome});await tx.put('last_end',end);await tx.delete('active');});
    return {status:outcome};
  }
}
