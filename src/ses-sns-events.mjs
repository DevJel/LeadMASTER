import { parseSesEventCorrelation } from "./ses-event-correlation.mjs";

function json(body, status = 200, headers = {}) {
  return Response.json(body, { status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff", ...headers } });
}

const snsEncoder=new TextEncoder();
function derNode(bytes,offset){const tag=bytes[offset],first=bytes[offset+1];let length=first,header=2;if(first&128){const count=first&127;if(count<1||count>4)throw Error("Invalid certificate");length=0;for(let i=0;i<count;i++)length=(length<<8)|bytes[offset+2+i];header+=count;}const start=offset,end=start+header+length;if(end>bytes.length)throw Error("Invalid certificate");return{tag,start,content:start+header,end,next:end};}
function certificateSpki(bytes){const outer=derNode(bytes,0),tbs=derNode(bytes,outer.content);let p=tbs.content;while(p<tbs.end){const node=derNode(bytes,p);if(node.tag===48){const first=derNode(bytes,node.content);if(first.tag===48){const second=derNode(bytes,first.next);if(second.tag===3)return bytes.slice(node.start,node.end);}}p=node.next;}throw Error("SNS certificate key missing");}
async function verifySnsEnvelope(envelope,expectedTopic){
 if(!envelope||envelope.TopicArn!==expectedTopic||!["Notification","SubscriptionConfirmation","UnsubscribeConfirmation"].includes(envelope.Type))return false;
 const certUrl=new URL(envelope.SigningCertURL||"");
 if(certUrl.protocol!=="https:"||certUrl.hostname!=="sns.ap-southeast-2.amazonaws.com"||!certUrl.pathname.startsWith("/SimpleNotificationService-"))return false;
 const fields=envelope.Type==="Notification"?["Message","MessageId",...(envelope.Subject?["Subject"]:[]),"Timestamp","TopicArn","Type"]:["Message","MessageId","SubscribeURL","Timestamp","Token","TopicArn","Type"];
 const canonical=fields.map(k=>k+"\n"+String(envelope[k]||"")+"\n").join("");
 const certResponse=await fetch(certUrl.toString());if(!certResponse.ok)return false;
 const pem=await certResponse.text(),b64=pem.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\s/g,"");
 const der=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
 const spki=certificateSpki(der),hash=envelope.SignatureVersion==="1"?"SHA-1":"SHA-256";
 const key=await crypto.subtle.importKey("spki",spki,{name:"RSASSA-PKCS1-v1_5",hash},false,["verify"]);
 const signature=Uint8Array.from(atob(envelope.Signature),c=>c.charCodeAt(0));
 return crypto.subtle.verify({name:"RSASSA-PKCS1-v1_5"},key,signature,snsEncoder.encode(canonical));
}
export async function sesSnsEvents(request,env){
 if(request.method!=="POST")return json({error:"Method not allowed"},405,{allow:"POST"});
 let envelope;try{envelope=await request.json()}catch{return json({error:"Invalid SNS message"},400)}
 const topic=env.SES_SNS_TOPIC_ARN;if(!topic)return json({error:"Event receiver not configured"},503);
 let verified=false;try{verified=await verifySnsEnvelope(envelope,topic)}catch{return json({error:"SNS signature validation failed"},403)}
 if(!verified)return json({error:"SNS signature validation failed"},403);
 if(envelope.Type==="SubscriptionConfirmation"){
  const confirm=new URL(envelope.SubscribeURL||"");
  if(confirm.protocol!=="https:"||confirm.hostname!=="sns.ap-southeast-2.amazonaws.com")return json({error:"Invalid confirmation URL"},400);
  const response=await fetch(confirm.toString());return response.ok?json({ok:true,subscription:"confirmed"}):json({error:"SNS confirmation failed"},502);
 }
 if(envelope.Type==="UnsubscribeConfirmation")return json({ok:true});
 let event;try{event=JSON.parse(envelope.Message)}catch{return json({error:"Invalid SES event"},400)}
 const type=String(event.eventType||event.notificationType||"").toUpperCase();
 const mail=event.mail||{},subject=mail.commonHeaders?.subject||"",timestamp=Date.now();
 const statusMap={BOUNCE:"bounced",COMPLAINT:"complaint",DELIVERY:"delivered",DELIVERY_DELAY:"delayed",REJECT:"rejected",RENDERING_FAILURE:"failed",SEND:"sent",SUBSCRIPTION:"subscription"};
 const status=statusMap[type];if(!status)return json({ok:true,ignored:true});
 const eventId=String(envelope.MessageId||"");if(eventId){const once=await env.AUTH_DB.prepare("INSERT OR IGNORE INTO mail_event_dedup (event_id,received_at) VALUES (?,?)").bind(eventId,timestamp).run();if((once.meta?.changes||0)===0)return json({ok:true,duplicate:true});}
 const messageTag=mail.tags?.leadmaster_message_id;const rawCorrelation=String((Array.isArray(messageTag)?messageTag[0]:messageTag)||((mail.headers||[]).find(h=>String(h.name||"").toLowerCase()==="x-leadmaster-message-id")?.value)||"");
 const {messageId:correlation,batchChunk}=parseSesEventCorrelation(rawCorrelation);
 let recipients=[];
 if(type==="BOUNCE")recipients=(event.bounce?.bouncedRecipients||[]).map(x=>({email:x.emailAddress,detail:x.diagnosticCode||event.bounce?.bounceType||"Bounce"}));
 else if(type==="COMPLAINT")recipients=(event.complaint?.complainedRecipients||[]).map(x=>({email:x.emailAddress,detail:event.complaint?.complaintFeedbackType||"Complaint"}));
 else if(type==="DELIVERY")recipients=(event.delivery?.recipients||[]).map(email=>({email,detail:"Delivered to receiving mail server"}));
 else if(type==="DELIVERY_DELAY")recipients=(event.deliveryDelay?.delayedRecipients||[]).map(x=>({email:x.emailAddress,detail:x.diagnosticCode||"Delivery delayed"}));
 else if(type==="REJECT")recipients=(mail.destination||[]).map(email=>({email,detail:event.reject?.reason||"Rejected"}));
 else if(type==="RENDERING_FAILURE")recipients=(mail.destination||[]).map(email=>({email,detail:event.failure?.errorMessage||"Rendering failure"}));
 else recipients=(mail.destination||[]).map(email=>({email,detail:"SES "+type}));
 for(let i=0;i<recipients.length;i++){
  const email=String(recipients[i].email||"").toLowerCase();if(!email)continue;
  const id="ses-"+String(envelope.MessageId||crypto.randomUUID())+"-"+i;
  const detail=JSON.stringify({type,detail:recipients[i].detail,bounceType:event.bounce?.bounceType||null});
  await env.AUTH_DB.prepare("INSERT OR IGNORE INTO email_delivery_events (id,email,subject,status,created_at,detail) VALUES (?,?,?,?,?,?)").bind(id,email,subject,status,timestamp,detail).run();
  if(correlation){
   // Large campaigns are split into SMTP groups of up to 10 recipients. SES
   // echoes the per-chunk tag (batch UUID + "-N"), so correlate each event to
   // the matching recipient row inside that campaign instead of trying to
   // match the suffixed tag to a message-row UUID.
   const adminUpdate=env.AUTH_DB.prepare("UPDATE admin_sent_mail SET delivery_status=CASE WHEN delivery_status='complaint' THEN delivery_status WHEN delivery_status IN ('bounced','rejected','failed') AND ?<>'complaint' THEN delivery_status WHEN delivery_status='delivered' AND ? IN ('sent','delayed') THEN delivery_status WHEN delivery_status='delayed' AND ?='sent' THEN delivery_status ELSE ? END,status=CASE WHEN ? IN ('bounced','rejected','failed') THEN 'failed' ELSE status END,queue_status=CASE WHEN ? IN ('bounced','rejected','failed') THEN 'failed' ELSE queue_status END,updated_at=? WHERE (id=? AND lower(recipient)=?) OR (?=1 AND batch_id=? AND lower(recipient)=?)").bind(status,status,status,status,status,status,timestamp,correlation,email,batchChunk===null?0:1,correlation,email);
   await adminUpdate.run();
   await env.AUTH_DB.prepare("UPDATE developer_email_requests SET delivery_status=CASE WHEN delivery_status='complaint' THEN delivery_status WHEN delivery_status IN ('bounced','rejected','failed') AND ?<>'complaint' THEN delivery_status WHEN delivery_status='delivered' AND ? IN ('sent','delayed') THEN delivery_status WHEN delivery_status='delayed' AND ?='sent' THEN delivery_status ELSE ? END,status=CASE WHEN ? IN ('bounced','rejected','failed') THEN 'failed' ELSE status END,updated_at=? WHERE id=? AND lower(recipient)=?").bind(status,status,status,status,status,timestamp,correlation,email).run();
  }
  if(type==="COMPLAINT"||(type==="BOUNCE"&&event.bounce?.bounceType==="Permanent")){
   await env.AUTH_DB.prepare("INSERT OR IGNORE INTO email_unsubscribes (id,email,source,created_at,reason) VALUES (?,?,?,?,?)").bind("ses-suppress-"+email.replace(/[^a-z0-9]/g,"-"),email,type==="COMPLAINT"?"ses-complaint":"ses-hard-bounce",timestamp,recipients[i].detail).run();
  }
 }
 const summary=({delivered:"Email delivered to the receiving mail server.",bounced:"An email could not be delivered.",complaint:"A recipient reported an email as unwanted.",delayed:"Email delivery is taking longer than expected.",rejected:"An email was rejected by the receiving service.",failed:"An email could not be prepared for sending.",sent:"An email was accepted by the sending service."})[status]||"Email status updated.";
 if(type!=="SEND"){
  await env.AUTH_DB.prepare("INSERT INTO workspace_activity (id,actor_email,action,summary,target_id,created_at) VALUES (?,?,'delivery_update',?,?,?)").bind(crypto.randomUUID(),"system",summary,correlation||eventId, timestamp).run();
  await env.AUTH_DB.prepare("INSERT INTO mail_notifications (id,type,title,message,target_id,created_at) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(),status,status==="delivered"?"Email delivered":"Email status updated",summary,correlation||eventId,timestamp).run();
 }
 return json({ok:true,event:type,recipients:recipients.length});
}


