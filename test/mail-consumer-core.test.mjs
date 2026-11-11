import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createMailConsumer } from '../src/mail-consumer-core.mjs';
const id='12345678-1234-4123-8123-123456789abc';
function message(source='admin') {return {body:{id,source},acks:0,retries:[],ack(){this.acks++},retry(v){this.retries.push(v)}}}
function setup(source='admin') {
 const sql=new DatabaseSync(':memory:');
 sql.exec(`CREATE TABLE admin_sent_mail (id TEXT PRIMARY KEY,recipient TEXT,subject TEXT,text_body TEXT,html_body TEXT,status TEXT,from_email TEXT,from_name TEXT,reply_to TEXT,queue_status TEXT,batch_id TEXT,updated_at INTEGER,error_code TEXT,created_at INTEGER,cc TEXT NOT NULL DEFAULT '[]',bcc TEXT NOT NULL DEFAULT '[]',created_by TEXT NOT NULL DEFAULT '');
 CREATE TABLE developer_email_requests (id TEXT PRIMARY KEY,recipient TEXT,subject TEXT,text_body TEXT,html_body TEXT,status TEXT,from_email TEXT,sender_name TEXT,reply_to TEXT,api_key_id TEXT,account_id TEXT,updated_at INTEGER,error_code TEXT);
 CREATE TABLE email_unsubscribes (email TEXT NOT NULL);
 CREATE TABLE workspace_activity (id TEXT,actor_email TEXT,action TEXT,summary TEXT,target_id TEXT,created_at INTEGER);
 CREATE TABLE mail_notifications (id TEXT,type TEXT,title TEXT,message TEXT,target_id TEXT,created_at INTEGER);`);
 sql.exec(readFileSync(new URL('../migrations/0009_mail_send_claims.sql',import.meta.url),'utf8'));
 if(source==='admin')sql.prepare('INSERT INTO admin_sent_mail (id,recipient,subject,text_body,status,from_email,from_name,reply_to,queue_status) VALUES (?,?,?,?,?,?,?,?,?)').run(id,'recipient@example.test','Hello','body','sending','sender@example.test','Sender','reply@example.test','queued');
 else sql.prepare('INSERT INTO developer_email_requests (id,recipient,subject,text_body,status,from_email,sender_name,reply_to,api_key_id,account_id) VALUES (?,?,?,?,?,?,?,?,?,?)').run(id,'recipient@example.test','Hello','body','sending','sender@example.test','Sender','reply@example.test','key','account');
 const db={failBatch:false,failActivity:false,prepare(query){let args=[];return {bind(...a){args=a;return this},async first(){return sql.prepare(query).get(...args)||null},async all(){return {results:sql.prepare(query).all(...args)}},async run(){if(db.failActivity&&query.includes('workspace_activity'))throw Error('activity failed');return {meta:{changes:Number(sql.prepare(query).run(...args).changes)}}},_exec(){return sql.prepare(query).run(...args)}}}, async batch(stmts){if(db.failBatch){db.failBatch=false;throw Error('D1 failed after SMTP acceptance')};sql.exec('BEGIN');try{let result=stmts.map(s=>s._exec());sql.exec('COMMIT');return result}catch(e){sql.exec('ROLLBACK');throw e}}};
 return {sql,db,env:{AUTH_DB:db},status:()=>sql.prepare(`SELECT status FROM ${source==='admin'?'admin_sent_mail':'developer_email_requests'} WHERE id=?`).get(id).status,claim:()=>sql.prepare('SELECT state FROM mail_send_claims WHERE source=? AND request_id=?').get(source,id)?.state};
}
function consumer(send,webhook=async()=>{}) {return createMailConsumer({send,deliverWebhook:webhook,sleep:async()=>{},clock:()=>123});}
test('successful send records acceptance and duplicate redelivery does not resend',async()=>{
 const s=setup();let sends=0; const c=consumer(async()=>{sends++});let a=message();await c.queue({messages:[a]},s.env);
 assert.equal(a.acks,1);assert.equal(s.status(),'accepted');assert.equal(s.claim(),'accepted');let b=message();await c.queue({messages:[b]},s.env);assert.equal(b.acks,1);assert.equal(sends,1);
});
test('concurrent deliveries acquire only one claim',async()=>{
 const s=setup();let sends=0, release;let started;const wait=new Promise(r=>release=r),signal=new Promise(r=>started=r);
 const c=consumer(async()=>{sends++;started();await wait});let a=message(),b=message();const first=c.queue({messages:[a]},s.env);await signal;await c.queue({messages:[b]},s.env);assert.equal(b.acks,1);release();await first;assert.equal(sends,1);assert.equal(s.status(),'accepted');
});
test('D1 failure after SMTP acceptance leaves durable fence and prevents redelivery send',async()=>{
 const s=setup();let sends=0;const c=consumer(async()=>{sends++;s.db.failBatch=true});const a=message();await c.queue({messages:[a]},s.env);
 assert.equal(a.acks,0);assert.equal(a.retries.length,1);assert.equal(s.claim(),'started');assert.equal(s.status(),'sending');const b=message();await c.queue({messages:[b]},s.env);assert.equal(b.acks,1);assert.equal(sends,1);assert.equal(s.claim(),'started');
});
test('uncertain transport outcome is recorded and never retried automatically',async()=>{
 const s=setup('developer');let sends=0;const c=consumer(async()=>{sends++;const e=Error('lost response');e.deliveryOutcome='unknown';throw e});const a=message('developer');await c.queue({messages:[a]},s.env);
 assert.equal(s.status(),'unknown');assert.equal(s.claim(),'unknown');assert.equal(a.acks,1);await c.queue({messages:[message('developer')]},s.env);assert.equal(sends,1);
});
test('definite pre-DATA failure is terminal rather than silently resent',async()=>{
 const s=setup();const c=consumer(async()=>{const e=Error();e.deliveryOutcome='not_accepted';throw e});const a=message();await c.queue({messages:[a]},s.env);
 assert.equal(s.status(),'failed');assert.equal(s.claim(),'failed');assert.equal(a.acks,1);
});
test('ancillary activity failures do not alter accepted outcome',async()=>{
 const s=setup();s.db.failActivity=true;const a=message();await consumer(async()=>{}).queue({messages:[a]},s.env);assert.equal(s.status(),'accepted');assert.equal(s.claim(),'accepted');assert.equal(a.acks,1);
});
test('missing migration fails closed before sending and schedules retry',async()=>{
 const s=setup();s.sql.exec('DROP TABLE mail_send_claims');let sends=0;const a=message();await consumer(async()=>{sends++}).queue({messages:[a]},s.env);assert.equal(sends,0);assert.equal(a.acks,0);assert.equal(a.retries.length,1);
});
test('malformed source and ID are acknowledged without sending',async()=>{
 const s=setup();let sends=0;const c=consumer(async()=>{sends++});const a=message('bad'),b=message();b.body.id='bad';await c.queue({messages:[a,b]},s.env);assert.equal(a.acks,1);assert.equal(b.acks,1);assert.equal(sends,0);
});
test('a claim left by a crashed process blocks another SMTP attempt',async()=>{
 const s=setup();s.sql.prepare("INSERT INTO mail_send_claims (source,request_id,state,claimed_at) VALUES (?,?,'started',?)").run('admin',id,123);
 let sends=0;const a=message();await consumer(async()=>{sends++}).queue({messages:[a]},s.env);assert.equal(sends,0);assert.equal(a.acks,1);assert.equal(s.status(),'sending');assert.equal(s.claim(),'started');
});

test('admin HTML reaches the transport with its plain-text alternative',async()=>{const s=setup();s.sql.prepare('UPDATE admin_sent_mail SET html_body=? WHERE id=?').run('<p>hello</p>',id);let sent;await consumer(async x=>{sent=x}).queue({messages:[message()]},s.env);assert.equal(sent.html,'<p>hello</p>');assert.equal(sent.text,'body');assert.equal(s.status(),'accepted')});

test('consecutive batches retain a 100ms pause after the last message', async()=>{
 const s=setup(),starts=[];let time=0;
 const c=createMailConsumer({send:async()=>{starts.push(time)},deliverWebhook:async()=>{},clock:()=>time,sleep:async ms=>{time+=ms}});
 const messages=[];
 for(let i=0;i<11;i++){
  const msg=message();msg.body.id=`10000000-0000-4000-8000-${String(i).padStart(12,'0')}`;messages.push(msg);
  s.sql.prepare('INSERT INTO admin_sent_mail (id,recipient,subject,text_body,status,from_email,from_name,reply_to,queue_status) VALUES (?,?,?,?,?,?,?,?,?)').run(msg.body.id,'recipient@example.test','Subject','body','sending','sender@example.test','Sender','reply@example.test','queued');
 }
 await c.queue({messages:messages.slice(0,10)},s.env);await c.queue({messages:messages.slice(10)},s.env);
 assert.equal(starts.length,11);for(let i=1;i<starts.length;i++)assert.ok(starts[i]-starts[i-1]>=100,`missing spacing between messages ${i} and ${i+1}`);
});

test('admin and developer recipients suppressed after enqueue are skipped, not sent',async()=>{
 for (const source of ['admin','developer']) {
  const s=setup(source);s.sql.prepare('INSERT INTO email_unsubscribes(email) VALUES (?)').run('Recipient@EXAMPLE.test');let sends=0;
  const a=message(source);await consumer(async()=>{sends++}).queue({messages:[a]},s.env);
  const table=source==='admin'?'admin_sent_mail':'developer_email_requests';
  assert.equal(sends,0);assert.equal(s.status(),'failed');assert.equal(s.claim(),'failed');assert.equal(a.acks,1);
  assert.equal(s.sql.prepare(`SELECT error_code FROM ${table} WHERE id=?`).get(id).error_code,'suppressed_at_dispatch');
  await consumer(async()=>{sends++}).queue({messages:[message(source)]},s.env);assert.equal(sends,0);
 }
});
test('missing suppression table fails closed before a claim and retries without sending',async()=>{
 const s=setup();s.sql.exec('DROP TABLE email_unsubscribes');let sends=0;const a=message();
 await consumer(async()=>{sends++}).queue({messages:[a]},s.env);assert.equal(sends,0);assert.equal(s.claim(),undefined);assert.equal(a.acks,0);assert.equal(a.retries.length,1);
});
test('suppression appearing between precheck and claim is respected by second check',async()=>{
 const s=setup(),prepare=s.db.prepare.bind(s.db);let reads=0,sends=0;
 s.db.prepare=(q)=>{const stmt=prepare(q);if(q.includes('SELECT 1 FROM email_unsubscribes')){const first=stmt.first.bind(stmt);stmt.first=async()=>{const r=await first();if(++reads===1)s.sql.prepare('INSERT INTO email_unsubscribes(email) VALUES (?)').run('recipient@example.test');return r}}return stmt};
 const a=message();await consumer(async()=>{sends++}).queue({messages:[a]},s.env);assert.equal(reads,2);assert.equal(sends,0);assert.equal(s.status(),'failed');assert.equal(a.acks,1);
});
test('suppression read failure after claim does not send and remains fenced',async()=>{
 const s=setup(),prepare=s.db.prepare.bind(s.db);let reads=0,sends=0;
 s.db.prepare=(q)=>{const stmt=prepare(q);if(q.includes('SELECT 1 FROM email_unsubscribes')){const first=stmt.first.bind(stmt);stmt.first=async()=>{if(++reads===2)throw Error('D1 outage');return first()}}return stmt};
 const a=message();await consumer(async()=>{sends++}).queue({messages:[a]},s.env);assert.equal(sends,0);assert.equal(s.claim(),'started');assert.equal(a.acks,0);assert.equal(a.retries.length,1);
 await consumer(async()=>{sends++}).queue({messages:[message()]},s.env);assert.equal(sends,0);
});

test('mail consumer forwards text-only and HTML-only bodies independently',async()=>{
 for(const source of ['admin','developer']){
  const table=source==='admin'?'admin_sent_mail':'developer_email_requests';
  const html=setup(source);html.sql.prepare('UPDATE '+table+' SET text_body=?,html_body=? WHERE id=?').run('','<h1>Only HTML</h1>',id);
  let htmlSent;await consumer(async options=>{htmlSent=options}).queue({messages:[message(source)]},html.env);
  assert.equal(htmlSent.text,'');assert.equal(htmlSent.html,'<h1>Only HTML</h1>');
  const plain=setup(source);plain.sql.prepare('UPDATE '+table+' SET text_body=?,html_body=? WHERE id=?').run('Only text',null,id);
  let textSent;await consumer(async options=>{textSent=options}).queue({messages:[message(source)]},plain.env);
  assert.equal(textSent.text,'Only text');assert.equal(Object.hasOwn(textSent,'html'),false);
 }
});

test('batch sends one private message per To recipient and copies only the first',async()=>{
 const s=setup();const batchId='22345678-1234-4123-8123-123456789abc';
 s.sql.prepare('UPDATE admin_sent_mail SET batch_id=?,reply_to=?,cc=?,bcc=?,created_at=? WHERE id=?').run(batchId,'','["copy@example.test"]','["blind@example.test"]',1,id);
 const second='32345678-1234-4123-8123-123456789abc';
 s.sql.prepare('INSERT INTO admin_sent_mail (id,recipient,subject,text_body,status,from_email,from_name,reply_to,queue_status,batch_id,created_at,cc,bcc) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run(second,'other@example.test','Hello','body','sending','sender@example.test','Sender','', 'queued',batchId,2,'["copy@example.test"]','["blind@example.test"]');
 const sends=[];const msg={body:{id:batchId,source:'admin',batch:true},acks:0,retries:[],ack(){this.acks++},retry(v){this.retries.push(v)}};
 await consumer(async options=>{sends.push(options)}).queue({messages:[msg]},s.env);
 assert.equal(sends.length,2);assert.equal(sends[0].to,'recipient@example.test');assert.equal(sends[1].to,'other@example.test');
 assert.deepEqual(sends[0].cc,['copy@example.test']);assert.deepEqual(sends[0].bcc,['blind@example.test']);
 assert.equal(Object.hasOwn(sends[1],'cc'),false);assert.equal(Object.hasOwn(sends[1],'bcc'),false);
 assert.equal(sends[0].messageId,id);assert.equal(sends[1].messageId,second);
 assert.equal(s.sql.prepare('SELECT status FROM admin_sent_mail WHERE id=?').get(id).status,'accepted');
 assert.equal(s.sql.prepare('SELECT status FROM admin_sent_mail WHERE id=?').get(second).status,'accepted');assert.equal(msg.acks,1);
});

test('batch respects per-recipient suppression and never marks a skipped recipient accepted',async()=>{
 const s=setup(),batchId='22345678-1234-4123-8123-123456789abc',second='32345678-1234-4123-8123-123456789abc';
 s.sql.prepare('UPDATE admin_sent_mail SET batch_id=?,created_at=? WHERE id=?').run(batchId,1,id);
 s.sql.prepare('INSERT INTO admin_sent_mail (id,recipient,subject,text_body,status,from_email,from_name,reply_to,queue_status,batch_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(second,'other@example.test','Hello','body','sending','sender@example.test','Sender','','queued',batchId,2);
 s.sql.prepare('INSERT INTO email_unsubscribes(email) VALUES (?)').run('recipient@example.test');const sent=[];const msg=message();msg.body={id:batchId,source:'admin',batch:true};
 await consumer(async value=>sent.push(value)).queue({messages:[msg]},s.env);
 assert.deepEqual(sent.map(x=>x.to),['other@example.test']);
 assert.deepEqual({...s.sql.prepare('SELECT status,error_code FROM admin_sent_mail WHERE id=?').get(id)},{status:'failed',error_code:'suppressed_at_dispatch'});
 assert.equal(s.sql.prepare('SELECT status FROM admin_sent_mail WHERE id=?').get(second).status,'accepted');
});

test('batch redelivery never replays an already claimed legacy batch',async()=>{
 const s=setup(),batchId='22345678-1234-4123-8123-123456789abc';s.sql.prepare('UPDATE admin_sent_mail SET batch_id=? WHERE id=?').run(batchId,id);
 s.sql.prepare("INSERT INTO mail_send_claims (source,request_id,state,claimed_at) VALUES ('admin',?,'started',?)").run(batchId,123);
 let sends=0;const msg=message();msg.body={id:batchId,source:'admin',batch:true};await consumer(async()=>sends++).queue({messages:[msg]},s.env);
 assert.equal(sends,0);assert.equal(msg.acks,1);assert.equal(s.status(),'sending');
});

test('batch redelivery resumes unsent recipients without duplicating accepted mail or copies',async()=>{
 const s=setup(),batchId='22345678-1234-4123-8123-123456789abc',second='32345678-1234-4123-8123-123456789abc';
 s.sql.prepare('UPDATE admin_sent_mail SET batch_id=?,created_at=?,cc=? WHERE id=?').run(batchId,1,'["copy@example.test"]',id);
 s.sql.prepare('INSERT INTO admin_sent_mail (id,recipient,subject,text_body,status,from_email,from_name,queue_status,batch_id,created_at,cc) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(second,'other@example.test','Hello','body','sending','sender@example.test','Sender','queued',batchId,2,'["copy@example.test"]');
 let seen=[];const c=createMailConsumer({send:async value=>{seen.push(value);if(value.to==='recipient@example.test')s.db.failBatch=true},deliverWebhook:async()=>{},sleep:async()=>{},clock:()=>123});
 const msg=message();msg.body={id:batchId,source:'admin',batch:true};await c.queue({messages:[msg]},s.env);assert.equal(msg.retries.length,1);
 const next=message();next.body=msg.body;await c.queue({messages:[next]},s.env);assert.equal(next.acks,1);
 assert.deepEqual(seen.map(x=>x.to),['recipient@example.test','other@example.test']);assert.equal(Object.hasOwn(seen[1],'cc'),false);
 assert.equal(s.sql.prepare('SELECT status FROM admin_sent_mail WHERE id=?').get(id).status,'sending');
 assert.equal(s.sql.prepare('SELECT status FROM admin_sent_mail WHERE id=?').get(second).status,'accepted');
});

test('a 500-recipient batch advances per recipient through a shared capped coordinator',async()=>{
 const {EmailDispatchCore}=await import('../src/email-queue-core.mjs');
 class Storage{constructor(){this.m=new Map()} async get(k){return this.m.get(k)} async put(k,v){this.m.set(k,v)} async transaction(fn){return fn(this)}}
 const s=setup(),batchId='22345678-1234-4123-8123-123456789abc';
 s.sql.prepare('UPDATE admin_sent_mail SET batch_id=?,created_at=? WHERE id=?').run(batchId,0,id);
 for(let i=1;i<500;i++){
  const rowId=`10000000-0000-4000-8000-${String(i).padStart(12,'0')}`;
  s.sql.prepare('INSERT INTO admin_sent_mail (id,recipient,subject,text_body,status,from_email,from_name,queue_status,batch_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)').run(rowId,`person${i}@example.test`,'Subject','body','sending','sender@example.test','Sender','queued',batchId,i);
 }
 let now=1000;const starts=[];const core=new EmailDispatchCore({storage:new Storage(),clock:()=>now,sleep:async ms=>{now+=ms},send:async value=>{starts.push({at:now,to:value.to,messageId:value.messageId});return {status:'accepted'}}});
 const c=createMailConsumer({send:async options=>{const {env,...job}=options;const result=await core.dispatch({...job,id:job.messageId});assert.equal(result.status,'accepted')},deliverWebhook:async()=>{},clock:()=>now,sleep:async ms=>{now+=ms}});
 const msg=message();msg.body={id:batchId,source:'admin',batch:true};await c.queue({messages:[msg]},s.env);
 assert.equal(msg.acks,1);assert.equal(starts.length,500);assert.equal(new Set(starts.map(x=>x.messageId)).size,500);
 assert.equal(s.sql.prepare("SELECT count(*) AS n FROM admin_sent_mail WHERE batch_id=? AND status='accepted'").get(batchId).n,500);
 for(const item of starts)assert.ok(starts.filter(x=>x.at>=item.at&&x.at<item.at+1000).length<=10);
});
