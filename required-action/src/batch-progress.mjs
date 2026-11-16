const json=(body,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
// Existing batch rows have an original sendable-recipient total. They do not record
// rejected/suppressed recipients, queue acknowledgements, or recipients later removed.
export async function batchProgressRoute(request,env,session,adminEmail){
 if(!session?.email)return json({error:'Unauthorized'},401);
 if(session.email!==adminEmail)return json({error:'Forbidden'},403);
 if(request.method!=='GET')return json({error:'Method not allowed'},405);
 if(!env.AUTH_DB)return json({error:'Batch progress unavailable'},503);
 try{
  // Avoid repeated scans of a potentially large production mailbox before migration.
  const index=await env.AUTH_DB.prepare("SELECT 1 AS ok FROM sqlite_master WHERE type='index' AND name='idx_admin_sent_mail_batch_id'").first();
  if(!index)return json({error:'Batch progress is temporarily unavailable.'},503);
  const rows=await env.AUTH_DB.prepare(`WITH recent AS (
    SELECT id,total_count,created_at FROM mail_send_batches
    WHERE created_by=? ORDER BY created_at DESC,id DESC LIMIT 20
   ) SELECT b.id,b.total_count,b.created_at,
    COUNT(m.id) AS recorded,
    SUM(CASE WHEN m.status='accepted' AND COALESCE(m.delivery_status,'') NOT IN ('bounced','rejected','failed') THEN 1 ELSE 0 END) AS accepted,
    SUM(CASE WHEN m.status='accepted' AND m.delivery_status='delivered' THEN 1 ELSE 0 END) AS delivered,
    SUM(CASE WHEN m.status='failed' OR m.delivery_status IN ('bounced','rejected','failed') THEN 1 ELSE 0 END) AS failed,
    SUM(CASE WHEN m.status='unknown' AND COALESCE(m.delivery_status,'') NOT IN ('bounced','rejected','failed') THEN 1 ELSE 0 END) AS unknown,
    SUM(CASE WHEN m.id IS NOT NULL AND m.status NOT IN ('accepted','failed','unknown') AND COALESCE(m.delivery_status,'') NOT IN ('bounced','rejected','failed') THEN 1 ELSE 0 END) AS unconfirmed
   FROM recent b LEFT JOIN admin_sent_mail m ON m.batch_id=b.id
   GROUP BY b.id,b.total_count,b.created_at ORDER BY b.created_at DESC,b.id DESC`).bind(session.email).all();
  return json({batches:(rows.results||[]).map(r=>{
   const total=Number(r.total_count),recorded=Number(r.recorded);
   return {id:r.id,created_at:r.created_at,total,accepted:Number(r.accepted),delivered:Number(r.delivered),failed:Number(r.failed),unknown:Number(r.unknown),unconfirmed:Number(r.unconfirmed),unaccounted:Math.max(0,total-recorded),inconsistent:recorded>total};
  }),note:'Accepted means accepted by the sending service, not delivered. Unconfirmed may require investigation; do not resend without checking.'});
 }catch{return json({error:'Batch progress is temporarily unavailable.'},503)}
}
