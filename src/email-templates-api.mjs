import { readBoundedJson } from './bounded-json.mjs';
const enc=new TextEncoder();
const json=(body,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
export async function emailTemplatesRoute(request,env,session,adminEmail){
 if(!session?.email||!session?.accountId)return json({error:'Unauthorized'},401);
 if(session.email!==adminEmail)return json({error:'Forbidden'},403);
 if(!env.AUTH_DB)return json({error:'Service unavailable'},503);
 const u=new URL(request.url),match=/^\/api\/admin\/templates(?:\/([0-9a-f-]{36}))?$/.exec(u.pathname);
 if(!match)return json({error:'Not found'},404);
 const id=match[1];
 if(!['GET','POST'].includes(request.method))return json({error:'Method not allowed'},405);
 if(request.method!=='GET'&&request.headers.get('origin')!==u.origin)return json({error:'Invalid request origin'},403);
 try{
  if(request.method==='GET'&&!id){const rows=await env.AUTH_DB.prepare('SELECT id,name,updated_at FROM email_templates WHERE account_id=? ORDER BY updated_at DESC LIMIT 100').bind(session.accountId).all();return json({templates:rows.results||[]})}
  if(request.method==='GET'&&id){const row=await env.AUTH_DB.prepare('SELECT id,name,subject,text_body,html_body,updated_at FROM email_templates WHERE id=? AND account_id=?').bind(id,session.accountId).first();return row?json({template:row}):json({error:'Template not found'},404)}
  if(id)return json({error:'Method not allowed'},405);
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')||''))return json({error:'Content-Type must be application/json'},415);
  let value;try{value=await readBoundedJson(request,600000)}catch{return json({error:'Invalid or oversized request'},400)}
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(x=>!['name','subject','text','html'].includes(x)))return json({error:'Invalid template'},400);
  const {name,subject,text,html}=value;
  if(typeof name!=='string'||!name.trim()||name.trim().length>80||/[\x00-\x1f\x7f]/.test(name)||typeof subject!=='string'||!subject.trim()||enc.encode(subject).length>300||/[\x00-\x1f\x7f]/.test(subject)||typeof text!=='string'||!text.trim()||enc.encode(text).length>50000||(html!==undefined&&html!==null&&(typeof html!=='string'||!html.trim()||enc.encode(html).length>200000)))return json({error:'Provide a template name, subject and message within the size limits'},400);
  // Limit and uniqueness are enforced by the INSERT and unique index, scoped to the account.
  const templateId=crypto.randomUUID(),now=Date.now();
  try{const r=await env.AUTH_DB.prepare('INSERT INTO email_templates (id,account_id,name,subject,text_body,html_body,created_at,updated_at) SELECT ?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM email_templates WHERE account_id=?)<100').bind(templateId,session.accountId,name.trim(),subject.trim(),text,html||null,now,now,session.accountId).run();if(Number(r.meta?.changes||0)!==1)return json({error:'Template limit reached'},409)}catch(e){if(String(e?.message||'').includes('UNIQUE constraint failed'))return json({error:'A template with this name already exists'},409);throw e}
  return json({id:templateId,name:name.trim(),updated_at:now},201);
 }catch{return json({error:'Templates are temporarily unavailable'},503)}
}
