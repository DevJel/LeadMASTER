import { readBoundedJson } from './bounded-json.mjs';
const enc=new TextEncoder();
const json=(body,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
const NAME=/[\x00-\x1f\x7f]/;
function validTemplate(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(x=>!['name','subject','text','html'].includes(x)))return null;
 const name=value.name,subject=value.subject,text=value.text===undefined?'':value.text,html=value.html===undefined||value.html===null?'':value.html;
 if(typeof name!=='string'||!name.trim()||name.trim().length>80||NAME.test(name)||
    typeof subject!=='string'||!subject.trim()||enc.encode(subject).length>300||NAME.test(subject)||
    typeof text!=='string'||enc.encode(text).length>50000||
    typeof html!=='string'||enc.encode(html).length>200000||
    (!text.trim()&&!html.trim()))return null;
 return {name:name.trim(),subject:subject.trim(),text,html:html.trim()?html:null};
}
async function activity(db,session,action,summary,id){
 try{await db.prepare('INSERT INTO workspace_activity (id,actor_email,action,summary,target_id,created_at) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),session.email,action,summary,id,Date.now()).run()}catch{}
}
export async function emailTemplatesRoute(request,env,session,adminEmail){
 if(!session?.email||!session?.accountId)return json({error:'Unauthorized'},401);
 if(session.email!==adminEmail)return json({error:'Forbidden'},403);
 if(!env.AUTH_DB)return json({error:'Service unavailable'},503);
 const u=new URL(request.url),match=/^\/api\/admin\/templates(?:\/([0-9a-f-]{36}))?$/.exec(u.pathname);
 if(!match)return json({error:'Not found'},404);
 const id=match[1],db=env.AUTH_DB;
 if(!['GET','POST','PUT','DELETE'].includes(request.method))return json({error:'Method not allowed'},405,{allow:'GET, POST, PUT, DELETE'});
 if(request.method!=='GET'&&request.headers.get('origin')!==u.origin)return json({error:'Invalid request origin'},403);
 try{
  if(request.method==='GET'&&!id){
   const rows=await db.prepare('SELECT id,name,updated_at FROM email_templates WHERE account_id=? ORDER BY updated_at DESC LIMIT 100').bind(session.accountId).all();
   return json({templates:rows.results||[]});
  }
  if(request.method==='GET'&&id){
   const row=await db.prepare('SELECT id,name,subject,text_body,html_body,updated_at FROM email_templates WHERE id=? AND account_id=?').bind(id,session.accountId).first();
   return row?json({template:row}):json({error:'Template not found'},404);
  }
  if(request.method==='DELETE'){
   if(!id)return json({error:'Choose a template to delete'},400);
   const row=await db.prepare('SELECT name FROM email_templates WHERE id=? AND account_id=?').bind(id,session.accountId).first();
   if(!row)return json({error:'Template not found'},404);
   const result=await db.prepare('DELETE FROM email_templates WHERE id=? AND account_id=?').bind(id,session.accountId).run();
   if(Number(result.meta?.changes||0)!==1)return json({error:'Template could not be deleted'},409);
   await activity(db,session,'template_deleted','Deleted the email template “'+row.name+'”.',id);
   return json({ok:true});
  }
  if(!/^application\/json(?:\\s*;|$)/i.test(request.headers.get('content-type')||''))return json({error:'Content-Type must be application/json'},415);
  let value;try{value=await readBoundedJson(request,600000)}catch{return json({error:'Invalid or oversized request'},400)}
  const template=validTemplate(value);
  if(!template)return json({error:'Add a template name, subject, and either a text or HTML message.'},400);
  const now=Date.now();
  if(request.method==='POST'){
   const templateId=crypto.randomUUID();
   try{
    const r=await db.prepare('INSERT INTO email_templates (id,account_id,name,subject,text_body,html_body,created_at,updated_at) SELECT ?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM email_templates WHERE account_id=?)<100')
      .bind(templateId,session.accountId,template.name,template.subject,template.text,template.html,now,now,session.accountId).run();
    if(Number(r.meta?.changes||0)!==1)return json({error:'Template limit reached'},409);
   }catch(e){if(String(e?.message||'').includes('UNIQUE constraint failed'))return json({error:'A template with this name already exists'},409);throw e}
   await activity(db,session,'template_saved','Saved the email template “'+template.name+'”.',templateId);
   return json({id:templateId,name:template.name,updated_at:now},201);
  }
  if(request.method==='PUT'){
   if(!id)return json({error:'Choose a template to update'},400);
   try{
    const r=await db.prepare('UPDATE email_templates SET name=?,subject=?,text_body=?,html_body=?,updated_at=? WHERE id=? AND account_id=?')
      .bind(template.name,template.subject,template.text,template.html,now,id,session.accountId).run();
    if(Number(r.meta?.changes||0)!==1)return json({error:'Template not found'},404);
   }catch(e){if(String(e?.message||'').includes('UNIQUE constraint failed'))return json({error:'A template with this name already exists'},409);throw e}
   await activity(db,session,'template_updated','Updated the email template “'+template.name+'”.',id);
   return json({id,name:template.name,updated_at:now});
  }
  return json({error:'Method not allowed'},405);
 }catch{return json({error:'Templates are temporarily unavailable'},503)}
}
