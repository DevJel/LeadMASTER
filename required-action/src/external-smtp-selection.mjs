// Unmounted sender selection helpers. Account identity must be derived from the
// authenticated session. A selected connection is pinned to its revision; these
// helpers do not open sockets, dispatch mail, or return credential material.
const ACCOUNT=/^acct_[A-Za-z0-9_-]{20,64}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validAccount(accountId){if(typeof accountId!=='string'||!ACCOUNT.test(accountId))throw new TypeError('Invalid account')}
function validSelection(id,revision){if(typeof id!=='string'||!UUID.test(id)||!Number.isSafeInteger(revision)||revision<1)throw new TypeError('Invalid sender selection')}
export async function listVerifiedExternalSenders(db,{accountId}){
 validAccount(accountId);
 const rows=await db.prepare("SELECT id,revision,name,email FROM external_smtp_connections WHERE account_id=? AND verification_status='verified' AND revoked_at IS NULL ORDER BY name,id LIMIT 100").bind(accountId).all();
 return rows.results||[];
}
export async function pinExternalSender(db,{accountId,id,revision}){
 validAccount(accountId);validSelection(id,revision);
 const row=await db.prepare("SELECT id,revision,email FROM external_smtp_connections WHERE account_id=? AND id=? AND revision=? AND verification_status='verified' AND revoked_at IS NULL").bind(accountId,id,revision).first();
 return row?{connectionId:row.id,connectionRevision:row.revision,fromEmail:row.email}:null;
}
// Recheck the pinned identity immediately before dispatch. Callers must still
// atomically claim the queue item and apply suppression and idempotency rules.
export async function checkPinnedExternalSender(db,{accountId,connectionId,connectionRevision,fromEmail}){
 const current=await pinExternalSender(db,{accountId,id:connectionId,revision:connectionRevision});
 return Boolean(current&&typeof fromEmail==='string'&&current.fromEmail===fromEmail);
}
