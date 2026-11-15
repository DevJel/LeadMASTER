// Internal, unmounted persistence helpers for LeadMASTER-originated SMTP submissions.
// Callers must derive account ownership from a trusted session or queue job, enforce
// sender ownership and only record observed outcomes. This module never connects to SMTP.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACCOUNT=/^acct_[A-Za-z0-9_-]{20,64}$/;
const STATES=new Set(['queued','accepted','failed','unknown']);
function checkIds(accountId,connectionId,messageId){
 if(typeof accountId!=='string'||!ACCOUNT.test(accountId)||typeof connectionId!=='string'||!UUID.test(connectionId)||(messageId!==undefined&&(typeof messageId!=='string'||!UUID.test(messageId))))throw new TypeError('Invalid activity identifier');
}
function checkTime(value){if(!Number.isSafeInteger(value)||value<0)throw new TypeError('Invalid timestamp')}
export async function recordSmtpQueued(db,{accountId,connectionId,messageId,at}){
 checkIds(accountId,connectionId,messageId);checkTime(at);
 const r=await db.prepare("INSERT INTO external_smtp_activity(account_id,connection_id,message_id,status,created_at,updated_at) VALUES(?,?,?,'queued',?,?) ON CONFLICT(account_id,message_id) DO NOTHING").bind(accountId,connectionId,messageId,at,at).run();
 return Number(r.meta?.changes||0)===1;
}
// State transitions are compare-and-set, preventing late or duplicate updates
// from overwriting a later outcome. Unknown can only be reconciled on evidence.
export async function transitionSmtpActivity(db,{accountId,connectionId,messageId,from,to,at}){
 checkIds(accountId,connectionId,messageId);checkTime(at);
 if(!STATES.has(from)||!STATES.has(to)||!((from==='queued'&&['accepted','failed','unknown'].includes(to))||(from==='unknown'&&['accepted','failed'].includes(to))))throw new TypeError('Invalid activity transition');
 const r=await db.prepare('UPDATE external_smtp_activity SET status=?,updated_at=? WHERE account_id=? AND connection_id=? AND message_id=? AND status=? AND updated_at<=?').bind(to,at,accountId,connectionId,messageId,from,at).run();
 return Number(r.meta?.changes||0)===1;
}
export async function listSmtpActivity(db,{accountId,connectionId,limit=50,before=null}){
 checkIds(accountId,connectionId);
 if(!Number.isSafeInteger(limit)||limit<1||limit>100)throw new TypeError('Invalid page size');
 if(before!==null){if(!before||typeof before!=='object'||Array.isArray(before))throw new TypeError('Invalid cursor');checkTime(before.createdAt);if(typeof before.messageId!=='string'||!UUID.test(before.messageId))throw new TypeError('Invalid cursor')}
 const countsResult=await db.prepare('SELECT status,COUNT(*) AS count FROM external_smtp_activity WHERE account_id=? AND connection_id=? GROUP BY status').bind(accountId,connectionId).all();
 const counts={queued:0,accepted:0,failed:0,unknown:0};for(const row of countsResult.results||[])if(STATES.has(row.status))counts[row.status]=Number(row.count);
 const query='SELECT message_id,status,created_at,updated_at FROM external_smtp_activity WHERE account_id=? AND connection_id=?'+(before?' AND (created_at<? OR (created_at=? AND message_id<?))':'')+' ORDER BY created_at DESC,message_id DESC LIMIT ?';
 const args=[accountId,connectionId,...(before?[before.createdAt,before.createdAt,before.messageId]:[]),limit+1];
 const result=await db.prepare(query).bind(...args).all(),rows=result.results||[],hasMore=rows.length>limit,items=rows.slice(0,limit),last=items.at(-1);
 return {counts,items,next:hasMore&&last?{createdAt:last.created_at,messageId:last.message_id}:null};
}
