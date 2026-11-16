// Unmounted human-admin API. No SMTP sockets are opened by these handlers.
// The caller must supply the authenticated session and configured administrator.
import {readBoundedJson} from './bounded-json.mjs';
import {createSmtpConnection,listSmtpConnections,replaceSmtpConnection,revokeSmtpConnection} from './external-smtp-store.mjs';
import {listSmtpActivity} from './external-smtp-activity.mjs';
import {verifyStoredSmtpConnection} from './external-smtp-verify.mjs';
const json=(body,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const only=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>keys.includes(k));
async function keyConfig(env){
 const value=typeof env.SMTP_CREDENTIAL_KEY?.get==='function'?await env.SMTP_CREDENTIAL_KEY.get():env.SMTP_CREDENTIAL_KEY;
 if(typeof value!=='string'||typeof env.SMTP_CREDENTIAL_KEY_ID!=='string'||!/^[A-Za-z0-9_-]{1,64}$/.test(env.SMTP_CREDENTIAL_KEY_ID))throw new Error('key unavailable');
 return {encryptionKey:value,keyVersion:env.SMTP_CREDENTIAL_KEY_ID};
}
export async function externalSmtpSettingsRoute(request,env,session,adminEmail,{probe}={}){
 if(!session?.email||!session?.accountId)return json({error:'Unauthorized'},401);
 if(session.email!==adminEmail)return json({error:'Forbidden'},403);
 if(!env?.AUTH_DB)return json({error:'Settings unavailable'},503);
 const url=new URL(request.url),m=/^\/api\/admin\/smtp(?:\/([0-9a-f-]{36})(?:\/(activity|test))?)?$/i.exec(url.pathname);
 if(!m||m[1]&&!ID.test(m[1]))return json({error:'Not found'},404);
 const id=m[1],activity=m[2],method=request.method,db=env.AUTH_DB,accountId=session.accountId;
 if(method!=='GET'&&request.headers.get('origin')!==url.origin)return json({error:'Invalid request origin'},403);
 try{
  if(method==='GET'&&!id)return json({connections:await listSmtpConnections(db,{accountId})});
  if(method==='GET'&&id&&activity==='activity'){
   // A caller must own the connection even when the sender has no activity.
   const owned=await db.prepare('SELECT id FROM external_smtp_connections WHERE account_id=? AND id=?').bind(accountId,id).first();
   if(!owned)return json({error:'Not found'},404);
   const rawLimit=url.searchParams.get('limit'),limit=rawLimit===null?50:Number(rawLimit),createdAt=url.searchParams.get('before_time'),messageId=url.searchParams.get('before_id');
   if((createdAt===null)!==(messageId===null))return json({error:'Invalid pagination'},400);
   const before=createdAt===null?null:{createdAt:Number(createdAt),messageId};
   return json(await listSmtpActivity(db,{accountId,connectionId:id,limit,before}));
  }
  if(id&&activity==='test'){
   if(method!=='POST')return json({error:'Method not allowed'},405);
   if(typeof probe!=='function')return json({error:'Connection testing is unavailable'},503);
   if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')||''))return json({error:'Content-Type must be application/json'},415);
   let body;try{body=await readBoundedJson(request,1024)}catch{return json({error:'Invalid or oversized request'},400)}
   if(!only(body,['revision'])||!Number.isSafeInteger(body.revision)||body.revision<1)return json({error:'Invalid revision'},400);
   let key;try{key=await keyConfig(env)}catch{return json({error:'Connection testing is unavailable'},503)}
   const outcome=await verifyStoredSmtpConnection({db,accountId,id,revision:body.revision,...key,probe});
   if(outcome.status==='connected')return json({status:'connected'});
   if(outcome.status==='failed')return json({error:'Connection could not be verified'},422);
   if(outcome.status==='rate_limited')return json({error:'Please wait before testing again'},429);
   if(outcome.status==='not_found_or_changed')return json({error:'Connection not found or changed'},409);
   return json({error:'Connection testing is unavailable'},503);
  }
  if(!['POST','PUT','DELETE'].includes(method))return json({error:'Method not allowed'},405);
  if(activity||method==='POST'&&id||method!=='POST'&&!id)return json({error:'Not found'},404);
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')||''))return json({error:'Content-Type must be application/json'},415);
  let body;try{body=await readBoundedJson(request,8192)}catch{return json({error:'Invalid or oversized request'},400)}
  const at=Date.now();
  if(method==='DELETE'){
   if(!only(body,['revision'])||!Number.isSafeInteger(body.revision)||body.revision<1)return json({error:'Invalid revision'},400);
   return await revokeSmtpConnection(db,{accountId,id,revision:body.revision,at})?json({revoked:true}):json({error:'Connection not found or changed'},409);
  }
  if(!only(body,method==='POST'?['config']:['config','revision'])||!only(body.config,['name','email','server','username','password','port','security'])||(method==='PUT'&&(!Number.isSafeInteger(body.revision)||body.revision<1)))return json({error:'Invalid settings'},400);
  let key;try{key=await keyConfig(env)}catch{return json({error:'SMTP settings temporarily unavailable'},503)}
  if(method==='POST'){
   const created=await createSmtpConnection(db,{accountId,config:body.config,at,...key});
   return created?json(created,201):json({error:'Connection limit reached'},409);
  }
  return await replaceSmtpConnection(db,{accountId,id,revision:body.revision,config:body.config,at,...key})?json({id,revision:body.revision+1,verification_status:'unverified'}):json({error:'Connection not found or changed'},409);
 }catch(error){if(error instanceof TypeError)return json({error:'Invalid settings or pagination'},400);return json({error:'SMTP settings temporarily unavailable'},503)}
}
