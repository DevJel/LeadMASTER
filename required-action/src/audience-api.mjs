import {readBoundedJson} from './bounded-json.mjs';
import {extractRecipientEmails} from './recipient-import.mjs';
const json=(v,status=200)=>Response.json(v,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
const GROUP_MAX=100, CONTACT_MAX=5000, MEMBER_MAX=500, IMPORT_MAX=500;
async function activity(db,session,action,summary,targetId){
 try{await db.prepare('INSERT INTO workspace_activity (id,actor_email,action,summary,target_id,created_at) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),session.email,action,summary,targetId,Date.now()).run()}catch{}
}

// This API does not infer marketing consent from a valid address or import.
export async function audienceRoute(request,env,session,adminEmail){
 if(!session?.email||!session?.accountId)return json({error:'Unauthorized'},401);
 if(session.email!==adminEmail)return json({error:'Forbidden'},403);
 if(!env.AUTH_DB)return json({error:'Audience temporarily unavailable'},503);
 const u=new URL(request.url),match=/^\/api\/admin\/audience\/groups(?:\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(\/members)?)?$/i.exec(u.pathname);
 if(!match)return json({error:'Not found'},404);
 const [,id,members]=match,db=env.AUTH_DB,account=session.accountId;let groupName='';
 if(!['GET','POST'].includes(request.method))return json({error:'Method not allowed'},405);
 if(request.method==='POST'&&request.headers.get('origin')!==u.origin)return json({error:'Invalid request origin'},403);
 try {
  if(request.method==='GET'&&!id){
   const r=await db.prepare('SELECT g.id,g.name,g.created_at,COUNT(m.email) AS member_count FROM audience_groups g LEFT JOIN audience_group_members m ON m.account_id=g.account_id AND m.group_id=g.id WHERE g.account_id=? GROUP BY g.id,g.name,g.created_at ORDER BY g.name LIMIT 100').bind(account).all();
   return json({groups:r.results||[]});
  }
  if(id){
   const group=await db.prepare('SELECT id,name,created_at FROM audience_groups WHERE id=? AND account_id=?').bind(id,account).first();
   if(!group)return json({error:'Group not found'},404);groupName=group.name;
   if(request.method==='GET'){
    const r=await db.prepare('SELECT email FROM audience_group_members WHERE account_id=? AND group_id=? ORDER BY email LIMIT 500').bind(account,id).all();
    return json({group,emails:(r.results||[]).map(x=>x.email)});
   }
   if(!members)return json({error:'Method not allowed'},405);
  } else if(members||request.method!=='POST')return json({error:'Method not allowed'},405);
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')||''))return json({error:'Content-Type must be application/json'},415);
  let body;try{body=await readBoundedJson(request,150000)}catch{return json({error:'Invalid or oversized request'},400)}
  if(!id){
   if(Object.keys(body).some(x=>x!=='name')||typeof body.name!=='string'||!body.name.trim()||body.name.trim().length>80||/[\x00-\x1f\x7f]/.test(body.name))return json({error:'Provide a group name of at most 80 characters'},400);
   const newId=crypto.randomUUID(),now=Date.now();
   try{const r=await db.prepare('INSERT INTO audience_groups(id,account_id,name,created_at) SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM audience_groups WHERE account_id=?) < ?').bind(newId,account,body.name.trim(),now,account,GROUP_MAX).run();if(Number(r.meta?.changes||0)!==1)return json({error:'Group limit reached'},409)}catch(e){if(String(e?.message||'').includes('UNIQUE constraint failed'))return json({error:'A group with this name already exists'},409);throw e}
   await activity(db,session,'audience_group_created','Created the audience group “'+body.name.trim()+'”.',newId);
   return json({id:newId,name:body.name.trim()},201);
  }
  if(Object.keys(body).some(x=>x!=='emails')||!Array.isArray(body.emails)||!body.emails.length||body.emails.length>IMPORT_MAX)return json({error:'Provide between 1 and 500 email addresses'},400);
  const emails=[];for(const value of body.emails){
   if(typeof value!=='string')return json({error:'Invalid email address'},400);
   const canonical=value.trim().toLowerCase(),found=extractRecipientEmails(canonical);
   if(found.length!==1||found[0]!==canonical)return json({error:'Invalid email address'},400);
   emails.push(canonical);
  }
  const unique=[...new Set(emails)],packed=JSON.stringify(unique),now=Date.now();
  // Each statement is set-based. D1 batch is transactional; the quota checks and writes
  // are serialized together. Existing memberships don't consume the LIMIT.
  const a=db.prepare(`INSERT INTO audience_contacts(account_id,email,created_at)
   SELECT ?,j.value,? FROM json_each(?) j WHERE NOT EXISTS
   (SELECT 1 FROM audience_contacts c WHERE c.account_id=? AND c.email=j.value)
   ORDER BY j.key LIMIT MAX(0,?-(SELECT COUNT(*) FROM audience_contacts WHERE account_id=?))`)
   .bind(account,now,packed,account,CONTACT_MAX,account);
  const b=db.prepare(`INSERT INTO audience_group_members(account_id,group_id,email,created_at)
   SELECT ?,?,j.value,? FROM json_each(?) j JOIN audience_contacts c ON c.account_id=? AND c.email=j.value
   WHERE NOT EXISTS (SELECT 1 FROM audience_group_members m WHERE m.account_id=? AND m.group_id=? AND m.email=j.value)
   ORDER BY j.key LIMIT MAX(0,?-(SELECT COUNT(*) FROM audience_group_members WHERE account_id=? AND group_id=?))`)
   .bind(account,id,now,packed,account,account,id,MEMBER_MAX,account,id);
  const result=await db.batch([a,b]);
  const added=Number(result[1]?.meta?.changes||0);
  if(added)await activity(db,session,'audience_members_added','Added '+added+' contact'+(added===1?'':'s')+' to the group “'+groupName+'”.',id);
  const exists=await db.prepare('SELECT COUNT(*) AS n FROM audience_group_members m JOIN json_each(?) j ON j.value=m.email WHERE m.account_id=? AND m.group_id=?').bind(packed,account,id).first();
  const present=Number(exists?.n||0);
  return json({submitted:emails.length,unique:unique.length,duplicates:emails.length-unique.length,added,already_in_group:present-added,not_added:unique.length-present});
 }catch{return json({error:'Audience temporarily unavailable'},503)}
}
