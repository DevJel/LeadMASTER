// Unmounted building blocks for account-owned external SMTP configuration.
// Hostname validation is NOT DNS/IP validation; never connect until the resolved
// destination and rebinding risks have been addressed in the transport layer.
const encoder=new TextEncoder();
const MAX_SECRET_BYTES=512;
const toBase64=bytes=>{let value='';for(const b of bytes)value+=String.fromCharCode(b);return btoa(value)};
const fromBase64=value=>{const raw=atob(value);return Uint8Array.from(raw,c=>c.charCodeAt(0))};
const clean=(value,max)=>typeof value==='string'&&value.trim()&&encoder.encode(value).length<=max&&!/[\x00-\x1f\x7f]/.test(value);
export function validateExternalSmtpConfig(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['name','email','server','username','password','port','security'].includes(k)))throw new TypeError('Invalid SMTP settings');
 const {name,email,server,username,password}=input;
 if(!clean(name,128)||!clean(email,254)||!clean(server,253)||!clean(username,MAX_SECRET_BYTES)||!clean(password,MAX_SECRET_BYTES))throw new TypeError('Complete all SMTP fields');
 const address=email.trim(),host=server.trim().toLowerCase();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)||address.includes('..'))throw new TypeError('Invalid sender email');
 // Restrict to normal domain labels; reject IP literals, private naming conventions,
 // URLs and strings that could be parsed differently by the socket runtime.
 if(!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(host)||host.endsWith('.local')||host.endsWith('.internal')||host.endsWith('.localhost')||host.endsWith('.invalid')||host.endsWith('.test')||host.endsWith('.example'))throw new TypeError('Enter a public SMTP hostname');
 const port=input.port===undefined?587:input.port,security=input.security===undefined?'starttls':input.security;
 if(!Number.isInteger(port)||!((port===587&&security==='starttls')||(port===465&&security==='tls')))throw new TypeError('Use port 587 with STARTTLS or port 465 with TLS');
 return {name:name.trim(),email:address,server:host,username:username.trim(),password,port,security};
}
async function keyFromBase64(value){
 let raw;try{raw=fromBase64(value)}catch{throw Error('SMTP credential encryption is unavailable')}
 if(raw.length!==32)throw Error('SMTP credential encryption is unavailable');
 return crypto.subtle.importKey('raw',raw,{name:'AES-GCM'},false,['encrypt','decrypt']);
}
function aad(accountId,connectionId){
 if(typeof accountId!=='string'||!accountId||typeof connectionId!=='string'||!connectionId)throw new TypeError('Account and connection required');
 return encoder.encode(JSON.stringify(['leadmaster-external-smtp-v1',accountId,connectionId]));
}
export async function encryptSmtpCredentials({username,password},base64Key,accountId,connectionId){
 if(!clean(username,MAX_SECRET_BYTES)||!clean(password,MAX_SECRET_BYTES))throw new TypeError('Invalid SMTP credentials');
 const key=await keyFromBase64(base64Key),iv=crypto.getRandomValues(new Uint8Array(12));
 const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad(accountId,connectionId)},key,encoder.encode(JSON.stringify({username,password})));
 return {version:1,iv:toBase64(iv),ciphertext:toBase64(new Uint8Array(encrypted))};
}
export async function decryptSmtpCredentials(envelope,base64Key,accountId,connectionId){
 try{
  if(!envelope||envelope.version!==1||typeof envelope.iv!=='string'||typeof envelope.ciphertext!=='string')throw Error();
  const iv=fromBase64(envelope.iv);if(iv.length!==12)throw Error();
  const key=await keyFromBase64(base64Key),raw=await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:aad(accountId,connectionId)},key,fromBase64(envelope.ciphertext));
  const result=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));
  if(!clean(result.username,MAX_SECRET_BYTES)||!clean(result.password,MAX_SECRET_BYTES))throw Error();
  return {username:result.username,password:result.password};
 }catch{throw Error('SMTP credentials unavailable')}
}
