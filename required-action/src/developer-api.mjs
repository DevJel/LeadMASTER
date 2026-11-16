import { sendSesEmail } from "./ses-smtp.mjs";
import { deliverWebhookEvent } from "./developer-webhooks.mjs";
import { submitInOrder, writeBestEffort } from "./queue-submission.mjs";
const enc = new TextEncoder();
const json = (body,status=200,headers={}) => Response.json(body,{status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff",...headers}});
const b64 = bytes => { let s=""; for(const b of bytes)s+=String.fromCharCode(b); return btoa(s).replaceAll("+","-").replaceAll("/","_").replace(/=+$/,""); };
const token = () => "lm_live_"+b64(crypto.getRandomValues(new Uint8Array(32)));
const hash = async value => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(value))),b=>b.toString(16).padStart(2,"0")).join("");
const email = /^[A-Za-z0-9.!#$%&'*+/=?^`_{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/;
function validMessage(v){
 if(!v||typeof v!=="object"||Array.isArray(v)||Object.keys(v).some(k=>!["to","subject","text","html","sender_name","reply_to"].includes(k)))return false;
 if(typeof v.to!=="string"||v.to.length>254||!email.test(v.to)||v.to.includes(".."))return false;
 if(typeof v.subject!=="string"||!v.subject.trim()||/[\r\n\x00-\x1f\x7f]/.test(v.subject)||enc.encode(v.subject).length>300)return false;
 const text=v.text==null?"":v.text,html=v.html==null?"":v.html;
 if(typeof text!=="string"||enc.encode(text).length>200000||typeof html!=="string"||enc.encode(html).length>200000||(!text.trim()&&!html.trim()))return false;
 if(v.sender_name!==undefined&&(typeof v.sender_name!=="string"||!/^[A-Za-z][A-Za-z .'-]{1,79}$/.test(v.sender_name.trim())))return false;
 if(v.reply_to!==undefined&&(typeof v.reply_to!=="string"||v.reply_to.length>254||!email.test(v.reply_to)||v.reply_to.includes("..")))return false;
 return true;
}
async function readBody(req,max=250000){const raw=await req.text();if(enc.encode(raw).length>max)throw Error("large");const v=JSON.parse(raw);if(!v||typeof v!=="object"||Array.isArray(v))throw Error("invalid");return v;}
export async function developerAdminRoute(request,env,session){
 if(!session)return json({error:"Unauthorized"},401);
 if(request.method!=="GET" && request.headers.get("Origin")!==new URL(request.url).origin)return json({error:"Invalid request origin"},403);
 if(!env.AUTH_DB)return json({error:"Service unavailable"},503);
 const url=new URL(request.url), id=url.pathname.split("/").filter(Boolean).at(-1);
 if(url.pathname==="/api/developer/keys"&&request.method==="GET"){
  const rows=await env.AUTH_DB.prepare("SELECT id,name,key_prefix,scopes,created_at,last_used_at,revoked_at,account_id FROM developer_api_keys WHERE account_id=? ORDER BY created_at DESC LIMIT 100").bind(session.accountId).all();
  return json({account:{id:session.accountId,api_base_url:"https://leadmaster.jelvan.pro/api/v1/accounts/"+session.accountId},keys:(rows.results||[]).map(r=>({...r,scopes:JSON.parse(r.scopes)}))});
 }
 if(url.pathname==="/api/developer/keys"&&request.method==="POST"){
  let body;try{body=await readBody(request,4000)}catch{return json({error:"Invalid request"},400)}
  const name=typeof body.name==="string"?body.name.trim():"";
  const scopes=Array.isArray(body.scopes)?[...new Set(body.scopes)]:["email:send","email:read"];
  if(!name||name.length>80||!scopes.length||scopes.some(s=>!["email:send","email:read","webhook:manage"].includes(s)))return json({error:"Provide a name and supported scopes"},400);
  const raw=token(), id=crypto.randomUUID(), now=Date.now();
  await env.AUTH_DB.prepare("INSERT INTO developer_api_keys (id,name,key_prefix,key_hash,scopes,created_by,created_at,last_used_at,revoked_at,account_id) VALUES (?,?,?,?,?,?,?,NULL,NULL,?)")
   .bind(id,name,raw.slice(0,16),await hash(raw),JSON.stringify(scopes),session.email,now,session.accountId).run();
  try{await env.AUTH_DB.prepare("INSERT INTO workspace_activity (id,actor_email,action,summary,target_id,created_at) VALUES (?,?,'api_key_created',?,?,?)").bind(crypto.randomUUID(),session.email,"Created an API key named “"+name+"”.",id,now).run()}catch{}
  return json({id,name,api_key:raw,key_prefix:raw.slice(0,16),scopes,account_id:session.accountId,api_base_url:"https://leadmaster.jelvan.pro/api/v1/accounts/"+session.accountId,email_endpoint:"https://leadmaster.jelvan.pro/api/v1/accounts/"+session.accountId+"/emails",webhook_endpoint:"https://leadmaster.jelvan.pro/api/v1/accounts/"+session.accountId+"/webhooks",created_at:now,warning:"Copy this key now. It will not be shown again."},201);
 }
 if(url.pathname.startsWith("/api/developer/keys/")&&request.method==="DELETE"){
  if(!/^[0-9a-f-]{36}$/i.test(id))return json({error:"Not found"},404);
  const result=await env.AUTH_DB.prepare("UPDATE developer_api_keys SET revoked_at=? WHERE id=? AND account_id=? AND revoked_at IS NULL").bind(Date.now(),id,session.accountId).run();
  if(result.meta?.changes||0){try{await env.AUTH_DB.prepare("INSERT INTO workspace_activity (id,actor_email,action,summary,target_id,created_at) VALUES (?,?,'api_key_revoked','Revoked an API key.',?,?)").bind(crypto.randomUUID(),session.email,id,Date.now()).run()}catch{}return json({revoked:true})}
  return json({error:"Not found or already revoked"},404);
 }
 return json({error:"Not found"},404);
}
export async function developerEmailRoute(request,env,connect,accountId){
 if(request.method!=="POST")return json({error:"Method not allowed"},405,{allow:"POST"});
 if(!env.AUTH_DB)return json({error:"Service unavailable"},503);
 const auth=request.headers.get("authorization")||"", m=/^Bearer (lm_live_[A-Za-z0-9_-]{43,})$/.exec(auth);
 if(!m)return json({error:"Unauthorized"},401,{"www-authenticate":"Bearer"});
 const row=await env.AUTH_DB.prepare("SELECT id,key_hash,scopes,revoked_at,account_id,created_by FROM developer_api_keys WHERE key_prefix=?").bind(m[1].slice(0,16)).first();
 if(!row||row.account_id!==accountId)return json({error:"Not found"},404);
 if(row.revoked_at||!(await crypto.subtle.digest("SHA-256",enc.encode(m[1])).then(b=>{const h=Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,"0")).join("");return h===row.key_hash})))return json({error:"Unauthorized"},401);
 const scopes=JSON.parse(row.scopes||"[]");if(!scopes.includes("email:send"))return json({error:"Insufficient scope"},403);
 if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type")||""))return json({error:"Content-Type must be application/json"},415);
 const idem=request.headers.get("idempotency-key")||"";if(!/^[A-Za-z0-9_-]{16,128}$/.test(idem))return json({error:"A 16–128 character Idempotency-Key header is required"},400);
 let body;try{body=await readBody(request)}catch{return json({error:"Invalid JSON or request too large"},400)}
 if(!validMessage(body))return json({error:"Invalid email payload"},400);
 const nowWindow=Date.now(), windowStart=nowWindow-60000;
 const limited=await env.AUTH_DB.prepare("INSERT INTO auth_rate_limits (bucket_key,window_start,count) VALUES (?, ?, 1) ON CONFLICT(bucket_key) DO UPDATE SET count=CASE WHEN auth_rate_limits.window_start<=? THEN 1 ELSE auth_rate_limits.count+1 END, window_start=CASE WHEN auth_rate_limits.window_start<=? THEN excluded.window_start ELSE auth_rate_limits.window_start END RETURNING count").bind("developer-api:"+row.id,nowWindow,windowStart,windowStart).first();
 if(Number(limited?.count||0)>30)return json({error:"Rate limit exceeded"},429,{"retry-after":"60"});
 const prior=await env.AUTH_DB.prepare("SELECT id,status,created_at FROM developer_email_requests WHERE api_key_id=? AND idempotency_key=?").bind(row.id,idem).first();
 if(prior)return json({id:prior.id,status:prior.status,created_at:prior.created_at,replayed:true},prior.status==="accepted"?200:202);
 const suppressed=await env.AUTH_DB.prepare("SELECT email FROM email_unsubscribes WHERE lower(email)=lower(?)").bind(body.to).first();
 if(suppressed)return json({error:"Recipient is on the LeadMASTER suppression list"},409);
 const id=crypto.randomUUID(),now=Date.now();
 const account=await env.AUTH_DB.prepare("SELECT name,owner_email,owner_name FROM accounts WHERE id=?").bind(accountId).first();
 const registeredEmail=String(account?.owner_email||row.created_by||"").trim().toLowerCase();
 const replyTo=String(body.reply_to||"").trim().toLowerCase();
 const accountName=String(account?.name||"").trim();
 const fallbackName=(registeredEmail.split("@")[0]||"user").replace(/[._-]+/g," ").replace(/\\b[a-z]/g,x=>x.toUpperCase());
 const requestedName=String(body.sender_name||"").trim();
 const textBody=typeof body.text==="string"?body.text:"",htmlBody=typeof body.html==="string"&&body.html.trim()?body.html:null;
 const senderName=requestedName||String(account?.owner_name||"").trim()|| (accountName&&accountName!=="My LeadMASTER workspace"?accountName:fallbackName);
 if(requestedName&&requestedName!==account?.owner_name)await env.AUTH_DB.prepare("UPDATE accounts SET owner_name=?,updated_at=? WHERE id=?").bind(requestedName,now,accountId).run();
 const senderLocal=(senderName.toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,48)||"user");
 const senderEmail=senderLocal+"@leadmaster.jelvan.pro";
 try{await env.AUTH_DB.prepare("INSERT INTO developer_email_requests (id,api_key_id,idempotency_key,recipient,subject,status,created_at,updated_at,error_code,account_id,from_email,sender_name,reply_to,text_body,html_body) VALUES (?,?,?,?,?,'sending',?,?,NULL,?,?,?,?,?,?)").bind(id,row.id,idem,body.to,body.subject,now,now,accountId,senderEmail,senderName,replyTo,textBody,htmlBody).run();}
 catch{return json({error:"Request already submitted or could not be recorded; retry with the same idempotency key"},409);}
 await env.AUTH_DB.prepare("UPDATE developer_api_keys SET last_used_at=? WHERE id=?").bind(now,row.id).run();
 if(!env.MAIL_SEND_QUEUE){
  await env.AUTH_DB.prepare("UPDATE developer_email_requests SET status='failed',updated_at=?,error_code='queue_unavailable' WHERE id=? AND status='sending'").bind(Date.now(),id).run();
  return json({id,status:"failed",error:"Sending queue is unavailable; no queue submission was attempted."},503);
 }
 const submission=await submitInOrder([()=>env.MAIL_SEND_QUEUE.send({id,source:"developer",apiKeyId:row.id,accountId})]);
 if(submission.status!=="queued")return json({id,status:"submission_unconfirmed",error:"Queue acceptance is uncertain. Do not submit a new request; check this request and reconcile it before retrying."},503);
 await writeBestEffort([()=>env.AUTH_DB.prepare("INSERT INTO workspace_activity (id,actor_email,action,summary,target_id,created_at) VALUES (?,?,'email_queued',?,?,?)").bind(crypto.randomUUID(),registeredEmail,"Added a message to the sending list for "+body.to,id,Date.now()).run()]);
 return json({id,status:"queued",message:"Your message has been added to the sending list. Queue acceptance is not delivery."},202);
}
export async function developerEmailStatus(request,env,accountId){
 if(request.method!=="GET")return json({error:"Method not allowed"},405,{allow:"GET"});
 const auth=request.headers.get("authorization")||"",m=/^Bearer (lm_live_[A-Za-z0-9_-]{43,})$/.exec(auth);if(!m)return json({error:"Unauthorized"},401);
 const row=await env.AUTH_DB.prepare("SELECT id,key_hash,scopes,revoked_at,account_id FROM developer_api_keys WHERE key_prefix=?").bind(m[1].slice(0,16)).first();
 if(!row||row.account_id!==accountId||row.revoked_at||await hash(m[1])!==row.key_hash)return json({error:"Unauthorized"},401);
 if(!JSON.parse(row.scopes||"[]").includes("email:read"))return json({error:"Insufficient scope"},403);
 const id=new URL(request.url).pathname.split("/").filter(Boolean).at(-1);
 const item=await env.AUTH_DB.prepare("SELECT id,status,recipient,subject,created_at,updated_at,error_code,delivery_status,from_email,reply_to FROM developer_email_requests WHERE id=? AND api_key_id=? AND account_id=?").bind(id,row.id,accountId).first();
 return item?json(item):json({error:"Not found"},404);
}

export async function developerAccountInfo(request,env,accountId){
 if(request.method!=="GET")return json({error:"Method not allowed"},405,{allow:"GET"});
 const auth=request.headers.get("authorization")||"",m=/^Bearer (lm_live_[A-Za-z0-9_-]{43,})$/.exec(auth);
 if(!m)return json({error:"Unauthorized"},401,{"www-authenticate":"Bearer"});
 const key=await env.AUTH_DB.prepare("SELECT id,key_hash,scopes,revoked_at,account_id FROM developer_api_keys WHERE key_prefix=?").bind(m[1].slice(0,16)).first();
 if(!key||key.revoked_at||key.account_id!==accountId||await hash(m[1])!==key.key_hash)return json({error:"Unauthorized"},401);
 const account=await env.AUTH_DB.prepare("SELECT id,name,owner_name,created_at,updated_at FROM accounts WHERE id=?").bind(accountId).first();
 if(!account)return json({error:"Not found"},404);
 return json({account:{...account,api_base_url:"https://leadmaster.jelvan.pro/api/v1/accounts/"+accountId,endpoints:{account:"/api/v1/accounts/"+accountId,email:"/api/v1/accounts/"+accountId+"/emails",email_status:"/api/v1/accounts/"+accountId+"/emails/{id}",webhooks:"/api/v1/accounts/"+accountId+"/webhooks",webhook_deliveries:"/api/v1/accounts/"+accountId+"/webhooks/{id}/deliveries"}},key:{id:key.id,scopes:JSON.parse(key.scopes||"[]")}});
}
