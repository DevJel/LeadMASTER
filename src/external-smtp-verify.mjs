// Unmounted verification coordinator. It is not an HTTP authorization or network
// security boundary. The caller must authenticate the account, enforce CSRF,
// provide a reviewed probe with SSRF-safe sockets and TLS verification, and
// supply the correct credential key version. Never log config or raw errors.
import {decryptSmtpCredentials} from './external-smtp-config.mjs';
const ACCOUNT=/^acct_[A-Za-z0-9_-]{20,64}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEY=/^[A-Za-z0-9_-]{1,64}$/;
const changes=r=>Number(r?.meta?.changes||0);
export async function verifyStoredSmtpConnection({db,accountId,id,revision,encryptionKey,keyVersion,probe,now=Date.now}) {
 if(!db||!ACCOUNT.test(accountId)||!UUID.test(id)||!Number.isSafeInteger(revision)||revision<1||!KEY.test(keyVersion)||typeof encryptionKey!=='string'||typeof probe!=='function'||typeof now!=='function')throw new TypeError('Invalid verification context');
 const at=now();if(!Number.isSafeInteger(at)||at<0||at>Number.MAX_SAFE_INTEGER-60000)throw new TypeError('Invalid verification time');
 const row=await db.prepare('SELECT id,name,email,server,port,security,credential_key_id,credential_envelope,revision FROM external_smtp_connections WHERE account_id=? AND id=? AND revision=? AND revoked_at IS NULL').bind(accountId,id,revision).first();
 if(!row)return {status:'not_found_or_changed'};
 if(row.credential_key_id!==keyVersion)return {status:'unavailable'};
 // A short account-wide lease limits concurrent outbound attempts. The cooldown
 // remains even after release; it is deliberately not scoped to one sender.
 const token=crypto.randomUUID();
 const lease=await db.prepare('INSERT INTO external_smtp_verification_leases(account_id,token,expires_at,next_allowed_at) VALUES(?,?,?,?) ON CONFLICT(account_id) DO UPDATE SET token=excluded.token,expires_at=excluded.expires_at,next_allowed_at=excluded.next_allowed_at WHERE external_smtp_verification_leases.expires_at<=? AND external_smtp_verification_leases.next_allowed_at<=?').bind(accountId,token,at+45000,at+30000,at,at).run();
 if(changes(lease)!==1)return {status:'rate_limited'};
 try{
  let credentials;try{credentials=await decryptSmtpCredentials(JSON.parse(row.credential_envelope),encryptionKey,accountId,id)}catch{return {status:'unavailable'}}
  let result;try{result=await probe({config:{name:row.name,email:row.email,server:row.server,port:row.port,security:row.security,...credentials},timeoutMs:30000})}catch{result={status:'failed'}}
  const status=result?.status==='connected'?'verified':'unverified';
  // The lease is checked inside the same statement so a timed-out or superseded
  // attempt cannot overwrite a newer result; the connection revision also gates it.
  const updated=await db.prepare('UPDATE external_smtp_connections SET verification_status=?,updated_at=MAX(updated_at,?) WHERE account_id=? AND id=? AND revision=? AND revoked_at IS NULL AND EXISTS (SELECT 1 FROM external_smtp_verification_leases WHERE account_id=? AND token=? AND expires_at>?)').bind(status,now(),accountId,id,revision,accountId,token,now()).run();
  return changes(updated)===1?{status:status==='verified'?'connected':'failed'}:{status:'not_found_or_changed'};
 }finally{
  const end=now();await db.prepare('UPDATE external_smtp_verification_leases SET expires_at=? WHERE account_id=? AND token=?').bind(end,accountId,token).run();
 }
}
