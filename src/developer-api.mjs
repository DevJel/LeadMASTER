import { sendSesEmail } from "./ses-smtp.mjs";
import { deliverWebhookEvent } from "./developer-webhooks.mjs";
const enc = new TextEncoder();
const json = (body,status=200,headers={}) => Response.json(body,{status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff",...headers}});
const b64 = bytes => { let s=""; for(const b of bytes)s+=String.fromCharCode(b); return btoa(s).replaceAll("+","-").replaceAll("/","_").replace(/=+$/,""); };
const token = () => "lm_live_"+b64(crypto.getRandomValues(new Uint8Array(32)));
const hash = async value => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(value))),b=>b.toString(16).padStart(2,"0")).join("");
const email = /^[A-Za-z0-9.!#$%&'*+/=?^`_{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/;
function validMessage(v){
 if(!v||typeof v!=="object"||Array.isArray(v)||Object.keys(v).some(k=>!["to","subject","text","html"].includes(k)))return false;
 if(typeof v.to!=="string"||v.to.length>254||!email.test(v.to)||v.to.includes(".."))return false;
 if(typeof v.subject!=="string"||!v.subject.trim()||/[\r\n\x00-\x1f\x7f]/.test(v.subject)||enc.encode(v.subject).length>300)return false;
 if(typeof v.text!=="string"||!v.text.trim()||enc.encode(v.text).length>200000)return false;
 return v.html===undefined||(typeof v.html==="string"&&!!v.html.trim()&&enc.encode(v.html).length<=200000);
}
async function readBody(req,max=250000){const raw=await req.text();if(enc.encode(raw).length>max)throw Error("large");const v=JSON.parse(raw);if(!v||typeof v!=="object"||Array.isArray(v))throw Error("invalid");return v;}
export async function developerAdminRoute(request,env,session){
 if(!session)return json({error:"Unauthorized"},401);
 if(request.method!=="GET" && request.headers.get("Origin")!==new URL(request.url).origin)return json({error:"Invalid request origin"},403);
 if(!env.AUTH_DB)return json({error:"Service unavailable"},503);
 const url=new URL(request.url), id=url.pathname.split("/").filter(Boolean).at(-1);
 if(url.pathname==="/api/developer/keys"&&request.method==="GET"){
  const rows=await env.AUTH_DB.prepare("SELECT id,name,key_prefix,scopes,created_at,last_used_at,revoked_at FROM developer_api_keys ORDER BY created_at DESC LIMIT 100").all();
  return json({keys:(rows.results||[]).map(r=>({...r,scopes:JSON.parse(r.scopes)}))});
 }
 if(url.pathname==="/api/developer/keys"&&request.method==="POST"){
  let body;try{body=await readBody(request,4000)}catch{return json({error:"Invalid request"},400)}
  const name=typeof body.name==="string"?body.name.trim():"";
  const scopes=Array.isArray(body.scopes)?[...new Set(body.scopes)]:["email:send","email:read"];
  if(!name||name.length>80||!scopes.length||scopes.some(s=>!["email:send","email:read","webhook:manage"].includes(s)))return json({error:"Provide a name and supported scopes"},400);
  const raw=token(), id=crypto.randomUUID(), now=Date.now();
  await env.AUTH_DB.prepare("INSERT INTO developer_api_keys (id,name,key_prefix,key_hash,scopes,created_by,created_at,last_used_at,revoked_at) VALUES (?,?,?,?,?,?,?,NULL,NULL)")
   .bind(id,name,raw.slice(0,16),await hash(raw),JSON.stringify(scopes),session.email,now).run();
  return json({id,name,api_key:raw,key_prefix:raw.slice(0,16),scopes,created_at:now,warning:"Copy this key now. It will not be shown again."},201);
 }
 if(url.pathname.startsWith("/api/developer/keys/")&&request.method==="DELETE"){
  if(!/^[0-9a-f-]{36}$/i.test(id))return json({error:"Not found"},404);
  const result=await env.AUTH_DB.prepare("UPDATE developer_api_keys SET revoked_at=? WHERE id=? AND revoked_at IS NULL").bind(Date.now(),id).run();
  return (result.meta?.changes||0)?json({revoked:true}):json({error:"Not found or already revoked"},404);
 }
 return json({error:"Not found"},404);
}
export async function developerEmailRoute(request,env,connect){
 if(request.method!=="POST")return json({error:"Method not allowed"},405,{allow:"POST"});
 if(!env.AUTH_DB)return json({error:"Service unavailable"},503);
 const auth=request.headers.get("authorization")||"", m=/^Bearer (lm_live_[A-Za-z0-9_-]{43,})$/.exec(auth);
 if(!m)return json({error:"Unauthorized"},401,{"www-authenticate":"Bearer"});
 const row=await env.AUTH_DB.prepare("SELECT id,key_hash,scopes,revoked_at FROM developer_api_keys WHERE key_prefix=?").bind(m[1].slice(0,16)).first();
 if(!row||row.revoked_at||!(await crypto.subtle.digest("SHA-256",enc.encode(m[1])).then(b=>{const h=Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,"0")).join("");return h===row.key_hash})))return json({error:"Unauthorized"},401);
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
 const id=crypto.randomUUID(),now=Date.now();
 try{await env.AUTH_DB.prepare("INSERT INTO developer_email_requests (id,api_key_id,idempotency_key,recipient,subject,status,created_at,updated_at,error_code) VALUES (?,?,?,?,?,'sending',?,?,NULL)").bind(id,row.id,idem,body.to,body.subject,now,now).run();}
 catch{return json({error:"Request already submitted or could not be recorded; retry with the same idempotency key"},409);}
 await env.AUTH_DB.prepare("UPDATE developer_api_keys SET last_used_at=? WHERE id=?").bind(now,row.id).run();
 try{
  await sendSesEmail({connect,env,to:body.to,subject:body.subject,text:body.text,...(body.html===undefined?{}:{html:body.html})});
  await env.AUTH_DB.prepare("UPDATE developer_email_requests SET status='accepted',updated_at=? WHERE id=?").bind(Date.now(),id).run();
  try{await deliverWebhookEvent(env,"email.accepted",{request_id:id,recipient:body.to,subject:body.subject},row.id)}catch{}
  return json({id,status:"accepted",message:"LeadMASTER accepted the message for processing. This is not proof of inbox delivery."},200);
 }catch(error){
  const status=error?.deliveryOutcome==="unknown"?"unknown":"failed";
  await env.AUTH_DB.prepare("UPDATE developer_email_requests SET status=?,updated_at=?,error_code=? WHERE id=?").bind(status,Date.now(),status==="unknown"?"delivery_outcome_unknown":"delivery_not_accepted",id).run();
  try{await deliverWebhookEvent(env,"email."+status,{request_id:id,recipient:body.to,subject:body.subject},row.id)}catch{}
  return json({id,status,error:"Email submission did not complete. Check this request before retrying."},status==="unknown"?202:502);
 }
}
export async function developerEmailStatus(request,env){
 if(request.method!=="GET")return json({error:"Method not allowed"},405,{allow:"GET"});
 const auth=request.headers.get("authorization")||"",m=/^Bearer (lm_live_[A-Za-z0-9_-]{43,})$/.exec(auth);if(!m)return json({error:"Unauthorized"},401);
 const row=await env.AUTH_DB.prepare("SELECT id,key_hash,scopes,revoked_at FROM developer_api_keys WHERE key_prefix=?").bind(m[1].slice(0,16)).first();
 if(!row||row.revoked_at||await hash(m[1])!==row.key_hash)return json({error:"Unauthorized"},401);
 if(!JSON.parse(row.scopes||"[]").includes("email:read"))return json({error:"Insufficient scope"},403);
 const id=new URL(request.url).pathname.split("/").filter(Boolean).at(-1);
 const item=await env.AUTH_DB.prepare("SELECT id,status,recipient,subject,created_at,updated_at,error_code FROM developer_email_requests WHERE id=? AND api_key_id=(SELECT id FROM developer_api_keys WHERE key_prefix=?)").bind(id,m[1].slice(0,16)).first();
 return item?json(item):json({error:"Not found"},404);
}
