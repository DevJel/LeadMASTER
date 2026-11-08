/** Experimental email submission boundary. Keep disabled until documented release gates pass. */
import { enqueueEmail, validateEmailJob } from './email-queue-core.mjs';
const encoder = new TextEncoder();
const KEY = /^[A-Za-z0-9_-]{16,128}$/;
const SECRET = /^[A-Za-z0-9_-]{43,128}$/;
const MAX_BODY = 100000;
const json = (body, status, extra = {}) => Response.json(body, {status, headers:{'cache-control':'no-store','x-content-type-options':'nosniff',...extra}});
async function readSecret(binding) {
  try { const value = typeof binding?.get === 'function' ? await binding.get() : binding; return typeof value === 'string' && SECRET.test(value) ? value : null; } catch { return null; }
}
async function equalToken(a,b) {
  // Compare fixed-size digests without early exit. The provisioned key must be
  // uniformly random; this does not turn a weak password into a secure key.
  const [x,y] = await Promise.all([crypto.subtle.digest('SHA-256',encoder.encode(a)),crypto.subtle.digest('SHA-256',encoder.encode(b))]);
  const aa=new Uint8Array(x),bb=new Uint8Array(y);let diff=0;
  for(let i=0;i<aa.length;i++) diff |= aa[i]^bb[i];
  return diff===0;
}
async function boundedBody(request) {
  if(!request.body) throw new TypeError('Missing body');
  const reader=request.body.getReader(), chunks=[];let size=0;
  try {
    for (;;) {const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BODY){try{await reader.cancel()}catch{};throw new RangeError('Too large')}chunks.push(value)}
  } finally {reader.releaseLock()}
  const bytes=new Uint8Array(size);let off=0;for(const chunk of chunks){bytes.set(chunk,off);off+=chunk.byteLength}
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}
export async function submitEmail(request,env) {
  if(request.method!=='POST') return json({error:'Method not allowed'},405,{allow:'POST'});
  // Deliberately opt-in: deployment, abuse controls and recovery must be reviewed first.
  if(env?.EMAIL_API_ENABLED!=='true' || !env?.EMAIL_QUEUE || typeof env.EMAIL_QUEUE.send!=='function') return json({error:'Service unavailable'},503);
  const expected=await readSecret(env.EMAIL_API_KEY);if(!expected) return json({error:'Service unavailable'},503);
  const auth=request.headers.get('authorization')||'';const match=/^Bearer ([A-Za-z0-9_-]{43,128})$/.exec(auth);
  if(!match || !(await equalToken(match[1],expected))) return json({error:'Unauthorized'},401,{'www-authenticate':'Bearer'});
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')||'')) return json({error:'Invalid request'},415);
  const id=request.headers.get('idempotency-key')||'';if(!KEY.test(id)) return json({error:'Invalid request'},400);
  let data;try{data=await boundedBody(request)}catch(e){return json({error:'Invalid request'},e instanceof RangeError?413:400)}
  if(!data || typeof data!=='object' || Array.isArray(data) || Object.keys(data).some(k=>!['to','subject','text'].includes(k))) return json({error:'Invalid request'},400);
  const job={id,to:data.to,subject:data.subject,text:data.text};
  try { validateEmailJob(job); } catch { return json({error:'Invalid request'},400); }
  try { await enqueueEmail(env.EMAIL_QUEUE,job); } catch { return json({error:'Service unavailable'},503); }
  // Accepted by the durable queue, not a guarantee of SMTP acceptance or delivery.
  return json({id,status:'queued'},202);
}
