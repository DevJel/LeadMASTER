import {readBoundedJson} from './bounded-json.mjs';
const encoder=new TextEncoder();
const json=(body,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
const bytes=value=>encoder.encode(value).length;
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const keys=new Set(['to','cc','bcc','subject','text','html','revision']);
function validate(body, update){
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!keys.has(k)))return null;
 if(update && (!Number.isSafeInteger(body.revision)||body.revision<1))return null;
 if(!update && 'revision' in body)return null;
 const out={};
 for(const key of ['to','cc','bcc','subject','text']){
  const value=body[key]===undefined?'':body[key];
  if(typeof value!=='string'||bytes(value)>(key==='text'?200000:key==='subject'?300:4096))return null;
  if(key!=='text' && /[\r\n\x00-\x1f\x7f]/.test(value))return null;
  out[key]=value;
 }
 if(body.html!==undefined&&body.html!==null&&(typeof body.html!=='string'||bytes(body.html)>200000))return null;
 out.html=body.html||null;
 // An empty draft is not useful and can otherwise exhaust the per-account cap.
 if(!out.to.trim()&&!out.cc.trim()&&!out.bcc.trim()&&!out.subject.trim()&&!out.text.trim()&&!out.html?.trim())return null;
 return out;
}
export async function emailDraftsRoute(request,env,session,adminEmail){
 if(!session?.email||!session?.accountId)return json({error:'Unauthorized'},401);
 if(session.email!==adminEmail)return json({error:'Forbidden'},403);
 if(!env.AUTH_DB)return json({error:'Drafts unavailable'},503);
 const url=new URL(request.url),match=/^\/api\/admin\/drafts(?:\/([0-9a-f-]{36}))?$/i.exec(url.pathname);
 if(!match||match[1]&&!ID.test(match[1]))return json({error:'Not found'},404);
 const id=match[1],method=request.method,db=env.AUTH_DB,account=session.accountId;
 if(!['GET','POST','PUT','DELETE'].includes(method))return json({error:'Method not allowed'},405);
 if(method!=='GET'&&request.headers.get('origin')!==url.origin)return json({error:'Invalid request origin'},403);
 if(method==='POST'&&id||['PUT','DELETE'].includes(method)&&!id)return json({error:'Not found'},404);
 try{
  if(method==='GET'&&!id){
   const rows=await db.prepare('SELECT id,to_addresses,subject,revision,created_at,updated_at FROM email_drafts WHERE account_id=? ORDER BY updated_at DESC,id LIMIT 500').bind(account).all();
   return json({drafts:rows.results||[]});
  }
  if(method==='GET'){
   const row=await db.prepare('SELECT id,to_addresses,cc_addresses,bcc_addresses,subject,text_body,html_body,revision,created_at,updated_at FROM email_drafts WHERE id=? AND account_id=?').bind(id,account).first();
   return row?json({draft:row}):json({error:'Draft not found'},404);
  }
  if(method==='DELETE'){
   const result=await db.prepare('DELETE FROM email_drafts WHERE id=? AND account_id=?').bind(id,account).run();
   return Number(result.meta?.changes||0)===1?json({ok:true}):json({error:'Draft not found'},404);
  }
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')||''))return json({error:'Content-Type must be application/json'},415);
  let body;try{body=await readBoundedJson(request,420000)}catch{return json({error:'Invalid or oversized request'},400)}
  const draft=validate(body,method==='PUT');if(!draft)return json({error:'Enter a valid, non-empty draft.'},400);
  const now=Date.now();
  if(method==='POST'){
   const draftId=crypto.randomUUID();
   const r=await db.prepare('INSERT INTO email_drafts(id,account_id,to_addresses,cc_addresses,bcc_addresses,subject,text_body,html_body,revision,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,1,?,? WHERE (SELECT COUNT(*) FROM email_drafts WHERE account_id=?)<500').bind(draftId,account,draft.to,draft.cc,draft.bcc,draft.subject,draft.text,draft.html,now,now,account).run();
   return Number(r.meta?.changes||0)===1?json({id:draftId,revision:1,updated_at:now},201):json({error:'Draft limit reached'},409);
  }
  const r=await db.prepare('UPDATE email_drafts SET to_addresses=?,cc_addresses=?,bcc_addresses=?,subject=?,text_body=?,html_body=?,revision=revision+1,updated_at=? WHERE id=? AND account_id=? AND revision=?').bind(draft.to,draft.cc,draft.bcc,draft.subject,draft.text,draft.html,now,id,account,body.revision).run();
  if(Number(r.meta?.changes||0)===1)return json({id,revision:body.revision+1,updated_at:now});
  const exists=await db.prepare('SELECT id FROM email_drafts WHERE id=? AND account_id=?').bind(id,account).first();
  return exists?json({error:'Draft changed elsewhere. Reload before saving.'},409):json({error:'Draft not found'},404);
 }catch{return json({error:'Drafts temporarily unavailable'},503)}
}
