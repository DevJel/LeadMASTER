// Unmounted SMTP authentication probe. The caller MUST supply a safe socket
// factory that enforces resolved-address policy, blocks rebinding and verifies
// the original hostname's certificate. This module is not an SSRF boundary.
// It never submits an email or returns/logs server responses or credentials.
import {validateExternalSmtpConfig} from './external-smtp-config.mjs';
const enc=new TextEncoder();
class ProbeFailure extends Error { constructor(code){super(code);this.code=code} }
class Replies {
 constructor(reader){this.reader=reader;this.buffer='';this.decoder=new TextDecoder('utf-8',{fatal:true})}
 async read(){const lines=[];let expected;
  for(;;){let i=this.buffer.indexOf('\r\n');while(i<0){const {value,done}=await this.reader.read();if(done)throw new ProbeFailure('connection_failed');this.buffer+=this.decoder.decode(value,{stream:true});if(this.buffer.length>16384)throw new ProbeFailure('invalid_response');i=this.buffer.indexOf('\r\n')}
   const line=this.buffer.slice(0,i);this.buffer=this.buffer.slice(i+2);const m=/^(\d{3})([ -])([\x20-\x7e]*)$/.exec(line);
   if(!m||(expected&&expected!==m[1])||lines.length>=100)throw new ProbeFailure('invalid_response');expected=m[1];lines.push(m[3]);if(m[2]===' ')return {code:Number(expected),lines};
  }
 }
}
function b64(s){let out='';for(const b of enc.encode(s))out+=String.fromCharCode(b);return btoa(out)}
function supports(lines,name){return lines.some(l=>new RegExp('^'+name+'(?:\\s|$)','i').test(l))}
function authMechanisms(lines){return lines.flatMap(l=>{const m=/^AUTH(?:\s+|=)(.*)$/i.exec(l);return m?m[1].trim().toUpperCase().split(/\s+/):[]})}
export async function probeExternalSmtp({config,openSafeSocket,timeoutMs=15000}){
 const c=validateExternalSmtpConfig(config);
 if(typeof openSafeSocket!=='function'||!Number.isInteger(timeoutMs)||timeoutMs<1000||timeoutMs>30000)throw new TypeError('Invalid probe configuration');
 let socket,timer,timedOut=false,reader,writer;
 async function run(){
  socket=openSafeSocket({hostname:c.server,port:c.port,security:c.security});
  if(!socket||typeof socket.close!=='function')throw new ProbeFailure('connection_failed');
  await socket.opened;if(timedOut)throw new ProbeFailure('timeout');reader=socket.readable.getReader();writer=socket.writable.getWriter();let replies=new Replies(reader);
  const expect=async(ok,otherwise='connection_failed')=>{const r=await replies.read();if(!ok.includes(r.code))throw new ProbeFailure(otherwise);return r};
  const command=async(value,ok,otherwise)=>{if(timedOut)throw new ProbeFailure('timeout');await writer.write(enc.encode(value+'\r\n'));return expect(ok,otherwise)};
  await expect([220]);let hello=await command('EHLO leadmaster.local',[250]);
  if(c.security==='starttls'){
   if(!supports(hello.lines,'STARTTLS'))throw new ProbeFailure('tls_unavailable');
   await command('STARTTLS',[220],'tls_unavailable');reader.releaseLock();writer.releaseLock();reader=undefined;writer=undefined;
   if(typeof socket.startTls!=='function')throw new ProbeFailure('tls_unavailable');
   try{socket=socket.startTls();await socket.opened;if(timedOut)throw new ProbeFailure('timeout')}catch{throw new ProbeFailure('tls_failed')}
   reader=socket.readable.getReader();writer=socket.writable.getWriter();replies=new Replies(reader);
   hello=await command('EHLO leadmaster.local',[250]);
  }
  const mechanisms=authMechanisms(hello.lines);
  if(mechanisms.includes('PLAIN'))await command('AUTH PLAIN '+b64('\0'+c.username+'\0'+c.password),[235],'authentication_failed');
  else if(mechanisms.includes('LOGIN')){await command('AUTH LOGIN',[334],'authentication_failed');await command(b64(c.username),[334],'authentication_failed');await command(b64(c.password),[235],'authentication_failed')}
  else throw new ProbeFailure('authentication_unavailable');
  return {status:'connected'};
 }
 try{return await Promise.race([run(),new Promise((_,reject)=>{timer=setTimeout(()=>{timedOut=true;reject(new ProbeFailure('timeout'))},timeoutMs)})])}
 catch(e){return {status:'failed',reason:timedOut?'timeout':e instanceof ProbeFailure?e.code:'connection_failed'}}
 finally{clearTimeout(timer);try{reader?.releaseLock()}catch{}try{writer?.releaseLock()}catch{}try{await socket?.close()}catch{}}
}
