// Unmounted storage helpers. Callers must derive accountId from an authenticated
// principal; these functions are not an HTTP authorization boundary. Connection
// verification and safe network access are not implemented here.
import {validateExternalSmtpConfig,encryptSmtpCredentials} from './external-smtp-config.mjs';
const ACCOUNT=/^acct_[A-Za-z0-9_-]{20,64}$/,UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,KEY=/^[A-Za-z0-9_-]{1,64}$/;
function check(accountId,at,id){if(typeof accountId!=='string'||!ACCOUNT.test(accountId)||!Number.isSafeInteger(at)||at<0||(id!==undefined&&(typeof id!=='string'||!UUID.test(id))))throw new TypeError('Invalid connection context')}
function keyId(value){if(typeof value!=='string'||!KEY.test(value))throw new TypeError('Invalid key version')}
const columns='id,name,email,server,port,security,revision,verification_status,created_at,updated_at';
export async function createSmtpConnection(db,{accountId,config,at,encryptionKey,keyVersion}){
 check(accountId,at);keyId(keyVersion);const c=validateExternalSmtpConfig(config),id=crypto.randomUUID();
 const envelope=JSON.stringify(await encryptSmtpCredentials(c,encryptionKey,accountId,id));
 const r=await db.prepare("INSERT INTO external_smtp_connections(id,account_id,name,email,server,port,security,credential_key_id,credential_envelope,revision,verification_status,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,?,1,'unverified',?,? WHERE (SELECT COUNT(*) FROM external_smtp_connections WHERE account_id=? AND revoked_at IS NULL)<100").bind(id,accountId,c.name,c.email,c.server,c.port,c.security,keyVersion,envelope,at,at,accountId).run();
 return Number(r.meta?.changes||0)===1?{id,revision:1,verification_status:'unverified'}:null;
}
export async function listSmtpConnections(db,{accountId}){
 check(accountId,0);const r=await db.prepare(`SELECT ${columns} FROM external_smtp_connections WHERE account_id=? AND revoked_at IS NULL ORDER BY created_at,id LIMIT 100`).bind(accountId).all();return r.results||[];
}
export async function replaceSmtpConnection(db,{accountId,id,revision,config,at,encryptionKey,keyVersion}){
 check(accountId,at,id);keyId(keyVersion);if(!Number.isSafeInteger(revision)||revision<1)throw new TypeError('Invalid revision');const c=validateExternalSmtpConfig(config),envelope=JSON.stringify(await encryptSmtpCredentials(c,encryptionKey,accountId,id));
 const r=await db.prepare("UPDATE external_smtp_connections SET name=?,email=?,server=?,port=?,security=?,credential_key_id=?,credential_envelope=?,revision=revision+1,verification_status='unverified',updated_at=? WHERE account_id=? AND id=? AND revision=? AND revoked_at IS NULL AND updated_at<=?").bind(c.name,c.email,c.server,c.port,c.security,keyVersion,envelope,at,accountId,id,revision,at).run();return Number(r.meta?.changes||0)===1;
}
export async function revokeSmtpConnection(db,{accountId,id,revision,at}){
 check(accountId,at,id);if(!Number.isSafeInteger(revision)||revision<1)throw new TypeError('Invalid revision');const r=await db.prepare("UPDATE external_smtp_connections SET revoked_at=?,updated_at=?,revision=revision+1,verification_status='unverified' WHERE account_id=? AND id=? AND revision=? AND revoked_at IS NULL AND updated_at<=?").bind(at,at,accountId,id,revision,at).run();return Number(r.meta?.changes||0)===1;
}
