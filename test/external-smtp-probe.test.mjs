import {test} from 'node:test';import assert from 'node:assert/strict';import {probeExternalSmtp} from '../src/external-smtp-probe.mjs';
const config={name:'Sales',email:'a@example.com',server:'smtp.example.com',username:'user',password:'private',port:587,security:'starttls'};const enc=new TextEncoder();
function server({auth='PLAIN',badAuth=false,noTls=false,malformed=false}={}){
 const writes=[];let upgraded=false,closed=false,step=0;const queue=[];let controller;
 function respond(s){controller.enqueue(enc.encode(s))}
 function makeSocket(secure,greeting=false){
  const readable=new ReadableStream({start(c){controller=c;if(greeting)respond(malformed?'bad\r\n':'220 welcome\r\n')}});
  const writable=new WritableStream({write(chunk){const text=new TextDecoder().decode(chunk).trim();writes.push({secure,text});
   if(text==='EHLO leadmaster.local')respond(secure||config.security==='tls'?`250-server\r\n250 AUTH ${auth}\r\n`:noTls?'250 server\r\n':'250-server\r\n250 STARTTLS\r\n');
   else if(text==='STARTTLS')respond('220 Ready\r\n');
   else if(text.startsWith('AUTH PLAIN '))respond(badAuth?'535 invalid\r\n':'235 ok\r\n');
   else if(text==='AUTH LOGIN'){step=1;respond('334 user\r\n')}
   else if(step===1){step=2;respond('334 pass\r\n')}
   else if(step===2){step=0;respond(badAuth?'535 invalid\r\n':'235 ok\r\n')}
   else throw Error('Unexpected command');
  }});
  return {opened:Promise.resolve(),readable,writable,startTls(){upgraded=true;return makeSocket(true)},async close(){closed=true;try{controller.close()}catch{}}};
 }
 return {open:({security})=>makeSocket(security==='tls',true),writes,get upgraded(){return upgraded},get closed(){return closed}};
}
test('STARTTLS probes authentication only after upgrading and never sends mail',async()=>{
 const s=server();const r=await probeExternalSmtp({config,openSafeSocket:s.open});assert.deepEqual(r,{status:'connected'});assert.equal(s.upgraded,true);assert.equal(s.closed,true);assert.ok(s.writes.find(x=>x.text.startsWith('AUTH PLAIN ')).secure);assert.ok(!s.writes.some(x=>/^(MAIL|RCPT|DATA)\b/i.test(x.text)));
});
test('supports LOGIN and sanitizes authentication failure',async()=>{const s=server({auth:'LOGIN',badAuth:true});const r=await probeExternalSmtp({config,openSafeSocket:s.open});assert.deepEqual(r,{status:'failed',reason:'authentication_failed'});assert.ok(!JSON.stringify(r).includes(config.password));assert.equal(s.closed,true)});
test('fails closed when STARTTLS is not offered or responses are malformed',async()=>{for(const [options,reason] of [[{noTls:true},'tls_unavailable'],[{malformed:true},'invalid_response']]){const s=server(options);assert.deepEqual(await probeExternalSmtp({config,openSafeSocket:s.open}),{status:'failed',reason});assert.ok(!s.writes.some(x=>x.text.startsWith('AUTH')))}});
test('requires bounded timeout and an injected policy-enforcing socket factory',async()=>{await assert.rejects(probeExternalSmtp({config,openSafeSocket:null}),TypeError);await assert.rejects(probeExternalSmtp({config,openSafeSocket:()=>{},timeoutMs:500}),TypeError)});

test('implicit TLS authenticates only over a TLS socket',async()=>{const s=server();const r=await probeExternalSmtp({config:{...config,port:465,security:'tls'},openSafeSocket:s.open});assert.deepEqual(r,{status:'connected'});assert.equal(s.upgraded,false);assert.ok(s.writes.every(x=>x.secure));assert.ok(!s.writes.some(x=>x.text==='STARTTLS'))});
test('timeout closes the socket and prevents late authentication',async()=>{let release,closed=false,writes=0;const opened=new Promise(r=>{release=r});const s={opened,readable:new ReadableStream({start(c){c.enqueue(enc.encode('220 welcome\r\n'))}}),writable:new WritableStream({write(){writes++}}),async close(){closed=true}};const result=await probeExternalSmtp({config,openSafeSocket:()=>s,timeoutMs:1000});assert.deepEqual(result,{status:'failed',reason:'timeout'});assert.equal(closed,true);release();await new Promise(r=>setTimeout(r,0));assert.equal(writes,0)});
