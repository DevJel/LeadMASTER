/**
 * Durable, single-object coordinator for LeadMASTER's SES SMTP submissions.
 * Rate reservations and idempotency state are persisted before SMTP is called.
 */
const encoder = new TextEncoder();
const MAX_ID = 128;
const ID = /^[A-Za-z0-9_-]{1,128}$/;
const EMAIL = /^[A-Za-z0-9.!#$%&'*+/=?^`_{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/;
const defaultSleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export function validateEmailJob(job) {
  if (!job || typeof job !== 'object' || Array.isArray(job) ||
      typeof job.id !== 'string' || job.id.length > MAX_ID || !ID.test(job.id) ||
      !(typeof job.to === 'string' ? (job.to.length <= 254 && EMAIL.test(job.to) && !job.to.includes('..')) : (Array.isArray(job.to) && job.to.length >= 1 && job.to.length <= 500 && job.to.every(x => typeof x === 'string' && x.length <= 254 && EMAIL.test(x) && !x.includes('..')))) ||
      typeof job.subject !== 'string' || !job.subject.trim() || /[\r\n\x00-\x1f\x7f]/.test(job.subject) ||
      encoder.encode(job.subject).length > 300) {
    throw new TypeError('Invalid queued message');
  }
  const hasText = typeof job.text === 'string' && Boolean(job.text.trim());
  const hasHtml = typeof job.html === 'string' && Boolean(job.html.trim());
  if (!hasText && !hasHtml) throw new TypeError('Add a text or HTML message body');
  if (job.text !== undefined && (typeof job.text !== 'string' || encoder.encode(job.text).length > 200000)) {
    throw new TypeError('Invalid text body');
  }
  if (job.html !== undefined && (typeof job.html !== 'string' || !job.html.trim() || encoder.encode(job.html).length > 200000)) {
    throw new TypeError('Invalid HTML body');
  }
  if (job.fromEmail !== undefined && (typeof job.fromEmail !== 'string' || job.fromEmail.length > 254 || !EMAIL.test(job.fromEmail) || job.fromEmail.includes('..'))) {
    throw new TypeError('Invalid sender address');
  }
  if (job.replyTo !== undefined && (typeof job.replyTo !== 'string' || job.replyTo.length > 254 || !EMAIL.test(job.replyTo) || job.replyTo.includes('..'))) {
    throw new TypeError('Invalid reply address');
  }
  for (const field of ['cc','bcc']) {
    if (job[field] !== undefined && (!Array.isArray(job[field]) || job[field].length > 100 ||
        job[field].some(x => typeof x !== 'string' || x.length > 254 || !EMAIL.test(x) || x.includes('..')))) {
      throw new TypeError('Invalid ' + field.toUpperCase() + ' addresses');
    }
  }
  if (job.fromName !== undefined && (typeof job.fromName !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9 .'-]{0,63}$/.test(job.fromName))) {
    throw new TypeError('Invalid sender name');
  }
  if (job.messageId !== undefined && (typeof job.messageId !== 'string' || !/^[0-9a-f-]{36}$/i.test(job.messageId))) {
    throw new TypeError('Invalid message ID');
  }
}

/** Trusted server-side callers must authenticate/authorize before enqueueing. */
export async function enqueueEmail(queue, job) {
  validateEmailJob(job);
  if (!queue || typeof queue.send !== 'function') throw new TypeError('Queue unavailable');
  const message = {id:job.id,to:job.to,subject:job.subject,
    ...(job.text === undefined ? {} : {text:job.text}),
    ...(job.html === undefined ? {} : {html:job.html})};
  if (encoder.encode(JSON.stringify(message)).length > 100000) throw new TypeError('Queued message too large');
  await queue.send(message);
  return {status:'queued'};
}

async function digest(job) {
  const parts = [job.to, job.subject, job.text ?? null, job.html ?? null,
    job.fromEmail ?? null, job.fromName ?? null, job.replyTo ?? null, job.cc ?? null, job.bcc ?? null, job.messageId ?? null];
  const input = encoder.encode(JSON.stringify(parts));
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256',input));
  return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
}

/** Storage must provide get() and atomic transaction() as Cloudflare DO storage does. */
export class EmailDispatchCore {
  constructor({ storage, send, clock = Date.now, sleep = defaultSleep, ratePerSecond = 10, maxPer24h = 50000 }) {
    if (!storage || typeof storage.transaction !== 'function' || typeof send !== 'function' ||
        !Number.isInteger(ratePerSecond) || ratePerSecond < 1 || ratePerSecond > 10 ||
        !Number.isInteger(maxPer24h) || maxPer24h < 1 || maxPer24h > 50000) {
      throw new TypeError('Invalid dispatch configuration');
    }
    this.storage=storage; this.send=send; this.clock=clock; this.sleep=sleep;
    // A 101 ms minimum spacing is intentionally conservative: never exceed 10/s.
    this.interval=Math.floor(1000/ratePerSecond)+1;
    this.maxPer24h=maxPer24h;
    this.tail=Promise.resolve();
  }

  dispatch(job) {
    const next=this.tail.then(()=>this.run(job));
    this.tail=next.catch(()=>{});
    return next;
  }

  async run(job) {
    validateEmailJob(job);
    const hash=await digest(job), key=`job:${job.id}`;
    let reservation;

    // Commit a persistent rate slot before making the external SMTP call.
    // If the process crashes, the slot is consumed (never refunded), which is
    // conservative and prevents a restart from releasing a burst.
    for (;;) {
      const now=this.clock();
      if (!Number.isFinite(now)) throw Error('Clock state unavailable');

      reservation=await this.storage.transaction(async tx=>{
        const prior=await tx.get(key);
        if (prior) {
          if (prior.hash!==hash) return {status:'id_conflict'};
          if (prior.status==='accepted' || prior.status==='failed') return {status:prior.status};
          // "sending" or "unknown" is never retried automatically; it does not
          // block unrelated messages from using later rate slots.
          return {status:'blocked_unknown'};
        }

        const last=await tx.get('last_reserved_at');
        if (last!==undefined && !Number.isFinite(last)) throw Error('Rate state unavailable');
        if (last!==undefined && now<last) return {status:'blocked_clock'};
        if (last!==undefined && now<last+this.interval) {
          return {status:'wait',delayMs:last+this.interval-now};
        }

        const previous=await tx.get('quota_window');
        if (previous && (!Number.isSafeInteger(previous.last) || !Array.isArray(previous.buckets) ||
            previous.buckets.length>1442 ||
            previous.buckets.some(b=>!Array.isArray(b)||b.length!==2||!Number.isSafeInteger(b[0])||
              !Number.isSafeInteger(b[1])||b[1]<1))) throw Error('Quota state unavailable');
        if (previous && now<previous.last) return {status:'blocked_clock'};

        const minute=Math.floor(now/60000)*60000;
        const buckets=(previous?.buckets||[]).filter(([start])=>start+60000>now-86400000).map(b=>[...b]);
        if (recipientUnits>this.maxPer24h || buckets.reduce((sum,b)=>sum+b[1],0)+recipientUnits>this.maxPer24h) {
          const earliest=Math.min(...buckets.map(([start])=>start));
          return {status:'deferred_quota',retryAfterSeconds:Math.min(86400,Math.max(1,
            Math.ceil((earliest+60000+86400000-now)/1000)))};
        }
        const current=buckets.find(b=>b[0]===minute);
        if (current) current[1]+=recipientUnits; else buckets.push([minute,recipientUnits]);

        await tx.put('quota_window',{last:now,buckets});
        await tx.put('last_reserved_at',now+(recipientUnits-1)*this.interval);
        await tx.put(key,{hash,status:'sending',reserved_at:now});
        return {status:'reserved'};
      });

      if (reservation.status!=='wait') break;
      const delay=Math.max(1,Math.ceil(reservation.delayMs));
      await this.sleep(delay);
    }

    if (reservation.status!=='reserved') return reservation;

    let outcome;
    try {
      const result=await this.send({
        to:job.to, subject:job.subject,
        ...(job.text === undefined ? {} : {text:job.text}),
        ...(job.html === undefined ? {} : {html:job.html}),
        ...(job.fromEmail === undefined ? {} : {fromEmail:job.fromEmail}),
        ...(job.fromName === undefined ? {} : {fromName:job.fromName}),
        ...(job.replyTo === undefined ? {} : {replyTo:job.replyTo}),
        ...(job.cc === undefined ? {} : {cc:job.cc}),
        ...(job.bcc === undefined ? {} : {bcc:job.bcc}),
        ...(job.messageId === undefined ? {} : {messageId:job.messageId})
      });
      outcome=result?.status==='accepted'?'accepted':'unknown';
    } catch(error) {
      outcome=error?.deliveryOutcome==='not_accepted'?'failed':'unknown';
    }

    // A failed or ambiguous attempt still consumes its rate slot. In particular,
    // unknown outcomes remain fenced by job ID but do not freeze unrelated mail.
    await this.storage.put(key,{hash,status:outcome});
    return {status:outcome};
  }
}
