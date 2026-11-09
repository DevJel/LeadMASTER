const clean=(v,max=998)=>String(v||"").replace(/[\r\n\x00-\x1f\x7f]/g," ").trim().slice(0,max);
function header(headers,name){try{return clean(headers.get(name)||"",998)}catch{return ""}}
function decodeSubject(value){
 return String(value||"").replace(/=\?UTF-8\?B\?([^?]+)\?=/gi,(_,b)=>{try{return new TextDecoder().decode(Uint8Array.from(atob(b),c=>c.charCodeAt(0)))}catch{return _}}).replace(/=\?UTF-8\?Q\?([^?]+)\?=/gi,(_,q)=>q.replace(/_/g," ").replace(/=([0-9a-f]{2})/gi,(_,h)=>String.fromCharCode(parseInt(h,16))));
}
function extractAddress(value,fallback){
 const raw=String(value||"");
 const angle=raw.match(/<([^<>]+)>/),candidate=(angle?.[1]||raw).trim().replace(/^mailto:/i,"");
 return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate)?candidate.toLowerCase():String(fallback||"").toLowerCase();
}
function extractName(value){
 const raw=String(value||""),angle=raw.match(/^\s*(.*?)\s*<[^<>]+>/);
 if(!angle)return "";
 return decodeSubject(angle[1].replace(/^["']|["']$/g,"")).trim().slice(0,160);
}
export default {
 async email(message,env,ctx){
  if(!env.AUTH_DB||!env.INBOUND_MAIL)throw new Error("Mailbox storage is not available");
  const maxBytes=25*1024*1024,advertisedSize=Number(message.rawSize||0);
  if(advertisedSize>maxBytes){message.setReject("Message is larger than the LeadMASTER mailbox limit.");return;}
  const raw=await new Response(message.raw).arrayBuffer(),rawSize=raw.byteLength;
  if(rawSize>maxBytes){message.setReject("Message is larger than the LeadMASTER mailbox limit.");return;}
  const id=crypto.randomUUID(),received=Date.now(),fromHeader=header(message.headers,"from"),from=extractAddress(fromHeader,message.from),fromName=extractName(fromHeader),to=clean(message.to,254).toLowerCase();
  if(!from||!to)throw new Error("Message sender or recipient is missing");
  const subject=decodeSubject(header(message.headers,"subject")).slice(0,998);
  const messageId=header(message.headers,"message-id").slice(0,998)||null;
  const key="inbox/"+new Date(received).toISOString().slice(0,10)+"/"+id+".eml";
  await env.INBOUND_MAIL.put(key,raw,{httpMetadata:{contentType:"message/rfc822"},customMetadata:{from,to,received_at:String(received),message_id:messageId||""}});
  try{
   await env.AUTH_DB.prepare("undefined").bind(id,from,fromName,to,subject,messageId,received,key,rawSize).run();
   await env.AUTH_DB.prepare("INSERT INTO workspace_activity (id,actor_email,action,summary,target_id,created_at) VALUES (?,?,'email_received',?,?,?)").bind(crypto.randomUUID(),"system","Received a new email from "+from,id,received).run();
   await env.AUTH_DB.prepare("INSERT INTO mail_notifications (id,type,title,message,target_id,created_at) VALUES (?,'received','New email received',?,?,?)").bind(crypto.randomUUID(),"New message from "+from,id,received).run();
  }catch(error){await env.INBOUND_MAIL.delete(key);throw error;}
 }
};