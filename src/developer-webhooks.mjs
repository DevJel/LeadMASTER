const enc=new TextEncoder();
const json=(v,s=200)=>Response.json(v,{status:s,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
const b64=b=>{let s="";for(const x of b)s+=String.fromCharCode(x);return btoa(s).replaceAll("+","-").replaceAll("/","_").replace(/=+$/,"")};
const makeSecret=()=>"whsec_"+b64(crypto.getRandomValues(new Uint8Array(32)));
const sha=async v=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(v))),b=>b.toString(16).padStart(2,"0")).join("");
const EVENTS=["email.accepted","email.failed","email.unknown"];
async function auth(req,env){
 const m=/^Bearer (lm_live_[A-Za-z0-9_-]{43,})$/.exec(req.headers.get("authorization")||"");
 if(!m)return null;
 const prefix=m[1].slice(0,16),row=await env.AUTH_DB.prepare("SELECT id,key_hash,scopes,revoked_at FROM developer_api_keys WHERE key_prefix=?").bind(prefix).first();
 if(!row||row.revoked_at||await sha(m[1])!==row.key_hash)return null;
 return {...row,scopes:JSON.parse(row.scopes||"[]")};
}
function safeUrl(value){try{const u=new URL(value);return u.protocol==="https:"&&!u.username&&!u.password&&u.hostname!=="localhost"&&!u.hostname.endsWith(".local")&&!/^127\.|^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(u.hostname)?u:null}catch{return null}}
export async function webhookRoute(req,env){
 if(!env.AUTH_DB)return json({error:"Service unavailable"},503);
 const key=await auth(req,env);if(!key)return json({error:"Unauthorized"},401);
 if(!key.scopes.includes("webhook:manage"))return json({error:"Insufficient scope: webhook:manage"},403);
 const url=new URL(req.url),parts=url.pathname.split("/").filter(Boolean),id=parts[3];
 if(parts.length===3&&req.method==="GET"){
  const rows=await env.AUTH_DB.prepare("SELECT id,name,target_url,events,created_at,revoked_at,last_delivery_at FROM developer_webhooks WHERE api_key_id=? ORDER BY created_at DESC").bind(key.id).all();
  return json({webhooks:(rows.results||[]).map(r=>({...r,events:JSON.parse(r.events)}))});
 }
 if(parts.length===3&&req.method==="POST"){
  let body;try{body=await req.json()}catch{return json({error:"Invalid JSON"},400)}
  const name=typeof body.name==="string"?body.name.trim():"",target=safeUrl(body.url),events=Array.isArray(body.events)?[...new Set(body.events)]:[];
  if(!name||name.length>80||!target||!events.length||events.some(e=>!EVENTS.includes(e)))return json({error:"Provide a name, public HTTPS URL and supported events"},400);
  const id=crypto.randomUUID(),secret=makeSecret(),now=Date.now();
  await env.AUTH_DB.prepare("INSERT INTO developer_webhooks (id,api_key_id,name,target_url,secret_hash,secret_value,events,created_at,revoked_at,last_delivery_at) VALUES (?,?,?,?,?,?,?,?,NULL,NULL)")
   .bind(id,key.id,name,target.href,await sha(secret),secret,JSON.stringify(events),now).run();
  return json({id,name,url:target.href,events,signing_secret:secret,created_at:now,warning:"Copy the signing secret now. It is shown only once."},201);
 }
 if(id&&parts.length===4&&req.method==="DELETE"){
  const r=await env.AUTH_DB.prepare("UPDATE developer_webhooks SET revoked_at=? WHERE id=? AND api_key_id=? AND revoked_at IS NULL").bind(Date.now(),id,key.id).run();
  return (r.meta?.changes||0)?json({revoked:true}):json({error:"Not found"},404);
 }
 if(id&&parts.length===5&&parts[4]==="deliveries"&&req.method==="GET"){
  const rows=await env.AUTH_DB.prepare("SELECT id,event_type,event_id,http_status,attempted_at,success FROM developer_webhook_deliveries WHERE webhook_id=? ORDER BY attempted_at DESC LIMIT 50").bind(id).all();
  return json({deliveries:rows.results||[]});
 }
 return json({error:"Not found"},404);
}
export async function deliverWebhookEvent(env,eventType,eventData){
 if(!env.AUTH_DB||!EVENTS.includes(eventType))return;
 const hooks=await env.AUTH_DB.prepare("SELECT id,api_key_id,target_url,secret_value FROM developer_webhooks WHERE revoked_at IS NULL AND EXISTS (SELECT 1 FROM json_each(events) WHERE value=?)").bind(eventType).all();
 for(const hook of hooks.results||[]){
  const eventId=crypto.randomUUID(),timestamp=Math.floor(Date.now()/1000),body=JSON.stringify({id:eventId,type:eventType,created_at:new Date().toISOString(),data:eventData});
  const signature=await crypto.subtle.sign("HMAC",await crypto.subtle.importKey("raw",enc.encode(hook.secret_value),{name:"HMAC",hash:"SHA-256"},false,["sign"]),enc.encode(timestamp+"."+body));
  const sig=Array.from(new Uint8Array(signature),b=>b.toString(16).padStart(2,"0")).join("");
  let status=null,success=0;
  try{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),7000);try{const response=await fetch(hook.target_url,{method:"POST",headers:{"content-type":"application/json","user-agent":"LeadMASTER-Webhooks/1.0","leadmaster-id":eventId,"leadmaster-timestamp":String(timestamp),"leadmaster-signature":"v1="+sig},body,signal:controller.signal,redirect:"manual"});status=response.status;success=response.ok?1:0;}finally{clearTimeout(timer)}}catch{}
  const now=Date.now();
  await env.AUTH_DB.prepare("INSERT INTO developer_webhook_deliveries (id,webhook_id,event_type,event_id,http_status,attempted_at,success) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(),hook.id,eventType,eventId,status,now,success).run();
  await env.AUTH_DB.prepare("UPDATE developer_webhooks SET last_delivery_at=? WHERE id=?").bind(now,hook.id).run();
 }
}
