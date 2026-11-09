/** Fail-closed queue consumer: the D1 claim is never automatically released. */
export function createMailConsumer({send, deliverWebhook, sleep = ms => new Promise(r => setTimeout(r, ms)), clock = Date.now}) {
 const bestEffort = async fn => { try { await fn(); } catch {} };
 async function process(message, env) {
  const body=message.body||{}, id=String(body.id||''), source=body.source||'admin';
  if(!/^[0-9a-f-]{36}$/i.test(id) || !['admin','developer'].includes(source)){message.ack();return;}
  const db=env.AUTH_DB;
  if(!db)throw Error('D1 unavailable');
  const table=source==='developer'?'developer_email_requests':'admin_sent_mail';
  const sql=source==='developer'
   ? 'SELECT id,recipient,subject,status,from_email,sender_name,reply_to,api_key_id,account_id,text_body,html_body FROM developer_email_requests WHERE id=?'
   : 'SELECT id,recipient,subject,text_body,html_body,status,from_email,from_name,reply_to,queue_status,batch_id FROM admin_sent_mail WHERE id=?';
  const row=await db.prepare(sql).bind(id).first();
  if(!row || row.status!=='sending'){message.ack();return;}
  // Fail before claiming if the suppression table cannot be read; a retry can
  // then try again safely. Re-check after claiming to narrow the race window.
  await db.prepare('SELECT 1 FROM email_unsubscribes WHERE lower(email)=lower(?) LIMIT 1').bind(row.recipient).first();
  // INSERT is atomic across consumers. The status predicate closes the read/claim gap.
  const claim=await db.prepare(`INSERT OR IGNORE INTO mail_send_claims (source,request_id,state,claimed_at) SELECT ?,?,'started',? WHERE EXISTS (SELECT 1 FROM ${table} WHERE id=? AND status='sending')`).bind(source,id,clock(),id).run();
  if(Number(claim.meta?.changes||0)!==1){message.ack();return;}
  // If this read fails after claiming, no SMTP call occurs. The started claim
  // stays fenced and needs reconciliation; never silently retry it as a send.
  const suppressed=await db.prepare('SELECT 1 FROM email_unsubscribes WHERE lower(email)=lower(?) LIMIT 1').bind(row.recipient).first();
  let outcome=suppressed?'failed':'accepted', errorCode=suppressed?'suppressed_at_dispatch':null;
  if(!suppressed)try {
   await send({env,to:row.recipient,subject:row.subject,text:row.text_body||'',...(row.html_body?{html:row.html_body}:{}),fromEmail:row.from_email,fromName:source==='developer'?row.sender_name:row.from_name,replyTo:row.reply_to,messageId:id});
  } catch(error) {
   // Only the transport can prove non-acceptance. Everything else is ambiguous.
   outcome=error?.deliveryOutcome==='not_accepted'?'failed':'unknown';
   errorCode=outcome==='failed'?'delivery_not_accepted':'delivery_outcome_unknown';
  }
  const now=clock();
  const update=source==='developer'
   ? db.prepare('UPDATE developer_email_requests SET status=?,updated_at=?,error_code=? WHERE id=? AND status=\'sending\'').bind(outcome,now,errorCode,id)
   : db.prepare('UPDATE admin_sent_mail SET status=?,queue_status=?,updated_at=?,error_code=? WHERE id=? AND status=\'sending\'').bind(outcome,outcome==='accepted'?'complete':outcome,now,errorCode,id);
  // A transaction keeps the message and its fence consistent. If this fails or the
  // process crashes, the started claim remains: redelivery must not send again.
  await db.batch([update,db.prepare('UPDATE mail_send_claims SET state=?,completed_at=? WHERE source=? AND request_id=? AND state=\'started\'').bind(outcome,now,source,id)]);
  message.ack();
  if(source==='developer' && outcome==='accepted')await bestEffort(()=>deliverWebhook(env,'email.accepted',{request_id:id,recipient:row.recipient,subject:row.subject},row.api_key_id,row.account_id));
  if(outcome==='accepted') {
   await bestEffort(()=>db.prepare("INSERT INTO workspace_activity (id,actor_email,action,summary,target_id,created_at) VALUES (?,?,'email_sent',?,?,?)").bind(crypto.randomUUID(),row.reply_to,'Email accepted by the sending service for '+row.recipient,id,now).run());
   await bestEffort(()=>db.prepare("INSERT INTO mail_notifications (id,type,title,message,target_id,created_at) VALUES (?,'sent','Email sent',?,?,?)").bind(crypto.randomUUID(),'Your message to '+row.recipient+' was accepted for sending.',id,now).run());
  } else if(outcome==='unknown') {
   await bestEffort(()=>db.prepare("INSERT INTO workspace_activity (id,actor_email,action,summary,target_id,created_at) VALUES (?,?,'email_unknown','The sending result could not be confirmed.',?,?)").bind(crypto.randomUUID(),row.reply_to,id,now).run());
  } else {
   await bestEffort(()=>db.prepare("INSERT INTO mail_notifications (id,type,title,message,target_id,created_at) VALUES (?,'failed','Message not sent',?,?,?)").bind(crypto.randomUUID(),suppressed?'A queued message was skipped because its recipient is on the do-not-contact list.':'LeadMASTER could not send a message to '+row.recipient+'.',id,now).run());
  }
 }
 return {async queue(batch,env){
  for(let i=0;i<batch.messages.length;i++){
   try{await process(batch.messages[i],env)}catch{batch.messages[i].retry({delaySeconds:60})}
   // Include the last message so the next sequential batch cannot start immediately.
   // Requires max_concurrency=1; this is pacing, not an account-wide quota guarantee.
   await sleep(100);
  }
 }};
}
