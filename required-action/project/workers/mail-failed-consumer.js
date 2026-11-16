export default {
 async queue(batch,env){
  for(const message of batch.messages){
   const body=message.body||{},id=String(body.id||''),source=body.source||'admin',now=Date.now();
   if(!/^[0-9a-f-]{36}$/i.test(id)||!['admin','developer'].includes(source)){message.ack();continue;}
   try{
    // A claim means the send may have reached SMTP even if the database row
    // still says sending. Such a result is unknown, never a safe failure.
    const isBatch=source==='admin'&&body.batch===true;
    const table=source==='developer'?'developer_email_requests':'admin_sent_mail';
    const match=isBatch?'batch_id=?':'id=?';
    const claimMatch=isBatch
      ? "(c.request_id=admin_sent_mail.id OR c.request_id=admin_sent_mail.batch_id)"
      : `(c.request_id=${table}.id)`;
    const claimed=`EXISTS (SELECT 1 FROM mail_send_claims c WHERE c.source='${source}' AND ${claimMatch})`;
    const queueUpdate=source==='admin'?`,queue_status=CASE WHEN ${claimed} THEN 'unknown' ELSE 'failed' END`:'';
    await env.AUTH_DB.prepare(`UPDATE ${table} SET status=CASE WHEN ${claimed} THEN 'unknown' ELSE 'failed' END${queueUpdate},updated_at=?,error_code=CASE WHEN ${claimed} THEN 'delivery_outcome_unknown' ELSE 'queue_exhausted' END WHERE ${match} AND status='sending'`).bind(now,id).run();
    // Do not announce that every item failed: some may have been accepted or
    // may have an uncertain result. Operators must reconcile before a resend.
    await env.AUTH_DB.prepare("INSERT INTO mail_notifications (id,type,title,message,target_id,created_at) VALUES (?,'failed','Sending requires review',?,?,?)").bind(crypto.randomUUID(),'Some messages could not be processed. Check individual statuses before resending.',id,now).run();
    await env.AUTH_DB.prepare("INSERT INTO workspace_activity (id,actor_email,action,summary,target_id,created_at) VALUES (?,?,'email_failed','Sending requires review; check individual statuses.',?,?)").bind(crypto.randomUUID(),'system',id,now).run();
    message.ack();
   }catch{message.retry({delaySeconds:30});}
  }
 }
};
