export default {
 async queue(batch,env){
  for(const message of batch.messages){
   const body=message.body||{},id=String(body.id||""),source=body.source||"admin",now=Date.now();
   if(!/^[0-9a-f-]{36}$/i.test(id)){message.ack();continue;}
   try{
    const row=source==="developer"
      ? await env.AUTH_DB.prepare("SELECT id,recipient,reply_to FROM developer_email_requests WHERE id=?").bind(id).first()
      : await env.AUTH_DB.prepare("SELECT id,recipient,reply_to FROM admin_sent_mail WHERE id=?").bind(id).first();
    if(row){
     if(source==="developer")await env.AUTH_DB.prepare("UPDATE developer_email_requests SET status='failed',updated_at=?,error_code='queue_exhausted' WHERE id=? AND status NOT IN ('accepted','unknown')").bind(now,id).run();
     else await env.AUTH_DB.prepare("UPDATE admin_sent_mail SET status='failed',queue_status='failed',updated_at=?,error_code='queue_exhausted' WHERE id=? AND status NOT IN ('accepted','unknown')").bind(now,id).run();
     await env.AUTH_DB.prepare("INSERT INTO mail_notifications (id,type,title,message,target_id,created_at) VALUES (?,'failed','Message not sent',?,?,?)").bind(crypto.randomUUID(),"A message to "+row.recipient+" could not be sent after several attempts. It is in Unsuccessful.",id,now).run();
     await env.AUTH_DB.prepare("INSERT INTO workspace_activity (id,actor_email,action,summary,target_id,created_at) VALUES (?,?,'email_failed',?,?,?)").bind(crypto.randomUUID(),row.reply_to||"system","A message to "+row.recipient+" could not be sent.",id,now).run();
    }
    message.ack();
   }catch{message.retry({delaySeconds:30});}
  }
 }
};