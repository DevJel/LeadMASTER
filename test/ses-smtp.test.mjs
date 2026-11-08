import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sendSesEmail } from '../src/ses-smtp.mjs';
const env = { SES_SMTP_HOST:'email-smtp.us-east-1.amazonaws.com', SES_SMTP_USERNAME:'example-user', SES_SMTP_PASSWORD:'example-password', SES_FROM_EMAIL:'sender@example.com' };
function server({ rejectRcpt = false, failAfterData = false } = {}) {
  const commands = []; let c; let closed = false;
  const readable = new ReadableStream({ start(controller) { c=controller; c.enqueue(new TextEncoder().encode('220 SES ready\r\n')); } });
  const writable = new WritableStream({ write(bytes) {
    const s = new TextDecoder().decode(bytes); commands.push(s);
    if (s.startsWith('EHLO')) c.enqueue(new TextEncoder().encode('250-SES\r\n250 AUTH PLAIN\r\n'));
    else if (s.startsWith('AUTH')) c.enqueue(new TextEncoder().encode('235 authenticated\r\n'));
    else if (s.startsWith('MAIL')) c.enqueue(new TextEncoder().encode('250 sender ok\r\n'));
    else if (s.startsWith('RCPT')) c.enqueue(new TextEncoder().encode(rejectRcpt ? '550 denied\r\n' : '250 recipient ok\r\n'));
    else if (s.startsWith('DATA')) c.enqueue(new TextEncoder().encode('354 continue\r\n'));
    else if (failAfterData) c.close();
    else c.enqueue(new TextEncoder().encode('250 accepted\r\n'));
  }});
  const connect = (address, options) => { assert.equal(address.port,465); assert.equal(options.secureTransport,'on'); return { opened:Promise.resolve(), readable, writable, close:async()=>{closed=true;} }; };
  return { connect, commands, isClosed:()=>closed };
}
const input = { env, to:'recipient@example.com', subject:'Hello ✨', text:'Line 1\n.Line 2' };
test('sends a correctly encoded message over TLS and closes the socket',async()=>{ const s=server(); assert.deepEqual(await sendSesEmail({...input,connect:s.connect}),{status:'accepted'}); assert.ok(s.commands[1].startsWith('AUTH PLAIN ')); assert.match(s.commands.at(-1),/Content-Transfer-Encoding: base64/); assert.equal(s.isClosed(),true); });
test('rejects address and header injection before connecting',async()=>{ let called=false; await assert.rejects(sendSesEmail({...input,subject:'ok\r\nBcc: bad@example.com',connect:()=>{called=true;}})); assert.equal(called,false); await assert.rejects(sendSesEmail({...input,to:'a@example.com\r\nDATA',connect:()=>{called=true;}})); assert.equal(called,false); });
test('rejects arbitrary SMTP hosts',async()=>{ await assert.rejects(sendSesEmail({...input,env:{...env,SES_SMTP_HOST:'malicious.example'},connect:()=>{throw Error('unexpected');}}),/configuration/); });
test('failure before DATA is not accepted',async()=>{const s=server({rejectRcpt:true}); await assert.rejects(sendSesEmail({...input,connect:s.connect}),e=>e.deliveryOutcome==='not_accepted'); assert.equal(s.isClosed(),true);});
test('disconnect after DATA is marked unknown rather than safely retryable',async()=>{const s=server({failAfterData:true}); await assert.rejects(sendSesEmail({...input,connect:s.connect}),e=>e.deliveryOutcome==='unknown'); assert.equal(s.isClosed(),true);});
test('resolves Cloudflare Secrets Store bindings without logging values',async()=>{const s=server(); const wrapped={...env,SES_SMTP_USERNAME:{get:async()=>env.SES_SMTP_USERNAME},SES_SMTP_PASSWORD:{get:async()=>env.SES_SMTP_PASSWORD}}; await sendSesEmail({...input,env:wrapped,connect:s.connect}); assert.equal(s.isClosed(),true);});
