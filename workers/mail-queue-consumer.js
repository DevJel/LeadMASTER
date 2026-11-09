import { connect } from "cloudflare:sockets";
import { sendSesEmail } from "../src/ses-smtp.mjs";
import { deliverWebhookEvent } from "../src/developer-webhooks.mjs";
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export default {
 async queue(batch,env){
  for(let i=0;i<batch.messages.length;i++){
   const msg=batch.messages[i],body=msg.body||{},id=String(body.id||""),source=body.source||"admin";
   if(!/^[0-9a-f-]{36}$/i.test(id)){msg.ack();continue;}
   let row;
   if(source==="developer")row=await env.AUTH_DB.prepare("SELECT id,recipient,subject,status,from_email,sender_name,reply_to,api_key_id,account_id,text_body,html_body FROM developer_email_requests WHERE id=?").bind(id).first();
   else row=await env.AUTH_DB.prepare("SELECT id,recipient,subject,text_body,status,from_email,from_name,reply_to,queue_status,batch_id FROM admin_sent_mail WHERE id=?").bind(id).first();
   if(!row||["accepted","unknown","failed"].includes(row.status)){msg.ack();continue;}
   try{
    if(source==="admin")await env.AUTH_DB.prepare("UPDATE admin_sent_mail SET queue_status='processing' WHERE id=?").bind(id).run();
    await sendSesEmail({connect,env,to:row.recipient,subject:row.subject,text:row.text_body||"",...(row.html_body?{html:row.html_body}:{}),fromEmail:row.from_email,fromName:source==="developer"?row.sender_name:row.from_name,replyTo:row.reply_to,messageId:id});
    if(source==="developer"){
     await env.AUTH_DB.prepare("UPDATE developer_email_requests SET status='accepted',updated_at=? WHERE id=?").bind(Date.now(),id).run();
     try{await deliverWebhookEvent(env,"email.accepted",{request_id:id,recipient:row.recipient,subject:row.subject},row.api_key_id,row.account_id);}catch{}
    }else{
     await env.AUTH_DB.prepare("UPDATE admin_sent_mail SET status='accepted',queue_status='complete',updated_at=? WHERE id=?").bind(Date.now(),id).run();
    }
    await env.AUTH_DB.prepare("INSERT INTO workspace_activity (id,actor_email,action,summary,target_id,created_at) VALUES (?,?,'email_sent',?,?,?)").bind(crypto.randomUUID(),row.reply_to,"Email sent to "+row.recipient,id,Date.now()).run();
    await env.AUTH_DB.prepare("INSERT INTO mail_notifications (id,type,title,message,target_id,created_at) VALUES (?,'sent','Email sent',?,?,?)").bind(crypto.randomUUID(),"Your message to "+row.recipient+" was accepted for sending.",id,Date.now()).run();
    msg.ack();
   }catch(error){
    if(error?.deliveryOutcome==="unknown"){
     if(source==="developer")await env.AUTH_DB.prepare("UPDATE developer_email_requests SET status='unknown',updated_at=?,error_code='delivery_outcome_unknown' WHERE id=?").bind(Date.now(),id).run();
     else await env.AUTH_DB.prepare("UPDATE admin_sent_mail SET status='unknown',queue_status='unknown',updated_at=?,error_code='delivery_outcome_unknown' WHERE id=?").bind(Date.now(),id).run();
     await env.AUTH_DB.prepare("INSERT INTO workspace_activity (id,actor_email,action,summary,target_id,created_at) VALUES (?,?,'email_unknown','The sending result could not be confirmed.',?,?)").bind(crypto.randomUUID(),row.reply_to,id,Date.now()).run();
     msg.ack();
    }else if(Number(msg.attempts||0)>=2){
     if(source==="developer")await env.AUTH_DB.prepare("UPDATE developer_email_requests SET status='failed',updated_at=?,error_code='delivery_not_accepted' WHERE id=?").bind(Date.now(),id).run();
     else await env.AUTH_DB.prepare("UPDATE admin_sent_mail SET status='failed',queue_status='failed',updated_at=?,error_code='delivery_not_accepted' WHERE id=?").bind(Date.now(),id).run();
     await env.AUTH_DB.prepare("INSERT INTO mail_notifications (id,type,title,message,target_id,created_at) VALUES (?,'failed','Message not sent','LeadMASTER could not send a message to "+String(row.recipient).replace(/'/g,"''")+".',?,?)").bind(crypto.randomUUID(),id,Date.now()).run();
     msg.ack();
    }else{
     if(source==="admin")await env.AUTH_DB.prepare("UPDATE admin_sent_mail SET queue_status='retrying',updated_at=?,error_code='delivery_not_accepted' WHERE id=?").bind(Date.now(),id).run();
     msg.retry({delaySeconds:Math.min(300,15*Math.pow(2,Number(msg.attempts||0)))});
    }
   }
   if(i<batch.messages.length-1)await pause(100);
  }
 }
};