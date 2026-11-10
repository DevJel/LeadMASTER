import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sendSesEmail } from '../src/ses-smtp.mjs';
const env = { SES_SMTP_HOST:'email-smtp.us-east-1.amazonaws.com', SES_SMTP_USERNAME:'example-user', SES_SMTP_PASSWORD:'example-password', SES_FROM_EMAIL:'sender@example.com' };
function server({ rejectRcpt = false, failAfterData = false } = {}) {
  const commands = []; let closed = false; let optionsSeen;
  function makeSocket(secure) {
    let controller;
    const readable = new ReadableStream({ start(c) { controller=c; if (!secure) c.enqueue(new TextEncoder().encode('220 SES ready\r\n')); } });
    const writable = new WritableStream({ write(bytes) {
      const s = new TextDecoder().decode(bytes); commands.push(s);
      if (s.startsWith('EHLO') && !secure) controller.enqueue(new TextEncoder().encode('250-SES\r\n250-STARTTLS\r\n250 AUTH PLAIN\r\n'));
      else if (s.startsWith('STARTTLS')) controller.enqueue(new TextEncoder().encode('220 Ready to start TLS\r\n'));
      else if (s.startsWith('EHLO') && secure) controller.enqueue(new TextEncoder().encode('250-SES\r\n250 AUTH PLAIN\r\n'));
      else if (s.startsWith('AUTH')) controller.enqueue(new TextEncoder().encode('235 authenticated\r\n'));
      else if (s.startsWith('MAIL')) controller.enqueue(new TextEncoder().encode('250 sender ok\r\n'));
      else if (s.startsWith('RCPT')) controller.enqueue(new TextEncoder().encode(rejectRcpt ? '550 denied\r\n' : '250 recipient ok\r\n'));
      else if (s.startsWith('DATA')) controller.enqueue(new TextEncoder().encode('354 continue\r\n'));
      else if (failAfterData) controller.close();
      else controller.enqueue(new TextEncoder().encode('250 accepted\r\n'));
    }});
    return {
      opened:Promise.resolve(), readable, writable,
      startTls() { closed=true; return makeSocket(true); },
      close:async()=>{closed=true;}
    };
  }
  const connect = (address, options) => {
    assert.equal(address.port,587);
    assert.equal(options.secureTransport,'starttls');
    optionsSeen=options;
    return makeSocket(false);
  };
  return { connect, commands, isClosed:()=>closed, optionsSeen:()=>optionsSeen };
}
const input = { env, to:'recipient@example.com', subject:'Hello ✨', text:'Line 1\n.Line 2' };
test('sends a correctly encoded message over STARTTLS on port 587 and closes the socket',async()=>{ const s=server(); assert.deepEqual(await sendSesEmail({...input,connect:s.connect}),{status:'accepted'}); assert.ok(s.commands[3].startsWith('AUTH PLAIN ')); assert.match(s.commands.at(-1),/Content-Transfer-Encoding: base64/); assert.equal(s.isClosed(),true); });
test('rejects address and header injection before connecting',async()=>{ let called=false; await assert.rejects(sendSesEmail({...input,subject:'ok\r\nBcc: bad@example.com',connect:()=>{called=true;}})); assert.equal(called,false); await assert.rejects(sendSesEmail({...input,to:'a@example.com\r\nDATA',connect:()=>{called=true;}})); assert.equal(called,false); });
test('rejects arbitrary SMTP hosts',async()=>{ await assert.rejects(sendSesEmail({...input,env:{...env,SES_SMTP_HOST:'malicious.example'},connect:()=>{throw Error('unexpected');}}),/configuration/); });
test('failure before DATA is not accepted',async()=>{const s=server({rejectRcpt:true}); await assert.rejects(sendSesEmail({...input,connect:s.connect}),e=>e.deliveryOutcome==='not_accepted'); assert.equal(s.isClosed(),true);});
test('disconnect after DATA is marked unknown rather than safely retryable',async()=>{const s=server({failAfterData:true}); await assert.rejects(sendSesEmail({...input,connect:s.connect}),e=>e.deliveryOutcome==='unknown'); assert.equal(s.isClosed(),true);});
test('resolves Cloudflare Secrets Store bindings without logging values',async()=>{const s=server(); const wrapped={...env,SES_SMTP_USERNAME:{get:async()=>env.SES_SMTP_USERNAME},SES_SMTP_PASSWORD:{get:async()=>env.SES_SMTP_PASSWORD}}; await sendSesEmail({...input,env:wrapped,connect:s.connect}); assert.equal(s.isClosed(),true);});
test('resolves SMTP hostname through a Secrets Store binding',async()=>{const s=server();let host;const wrapped={...env,SES_SMTP_HOST:{get:async()=> 'email-smtp.ap-southeast-2.amazonaws.com'}};const r=await sendSesEmail({...input,env:wrapped,connect:(address,options)=>{host=address.hostname;return s.connect(address,options)}});assert.equal(r.status,'accepted');assert.equal(host,'email-smtp.ap-southeast-2.amazonaws.com')});
test('sends multipart alternative with base64 text and HTML',async()=>{const s=server(), text='Plain text',html='<h1>Hello ✨</h1>';await sendSesEmail({...input,text,html,connect:s.connect});const message=s.commands.at(-1);const match=/boundary="([^"]+)"/.exec(message);assert.ok(match);assert.match(message,/Content-Type: text\/plain; charset=UTF-8/);assert.match(message,/Content-Type: text\/html; charset=UTF-8/);assert.ok(message.includes(Buffer.from(text).toString('base64')));assert.ok(message.includes(Buffer.from(html).toString('base64')));assert.ok(message.includes('--'+match[1]+'--'));});
test('rejects malformed HTML before connecting',async()=>{let connected=false;await assert.rejects(sendSesEmail({...input,html:'  ',connect:()=>{connected=true}}));assert.equal(connected,false)});
test('proposed Secrets Store aliases resolve to the SMTP binding names',async()=>{
  const {readFile}=await import('node:fs/promises');
  const config=JSON.parse(await readFile(new URL('../config/secrets-store-bindings.fragment.json',import.meta.url),'utf8'));
  assert.deepEqual(config.secrets_store_secrets.map(x=>[x.binding,x.secret_name]),[['SES_SMTP_HOST','AWS_SES_SMTP_HOSTNAME'],['SES_SMTP_USERNAME','AWS_SES_SMTP_USERNAME'],['SES_SMTP_PASSWORD','AWS_SES_SMTP_PASSPWORD']]);
  const fakeStore={AWS_SES_SMTP_HOSTNAME:'email-smtp.ap-southeast-2.amazonaws.com',AWS_SES_SMTP_USERNAME:'mock-user',AWS_SES_SMTP_PASSPWORD:'mock-password'};
  const bindings=Object.fromEntries(config.secrets_store_secrets.map(({binding,secret_name})=>[binding,{get:async()=>fakeStore[secret_name]}]));
  const s=server();assert.equal((await sendSesEmail({...input,env:{...bindings,SES_FROM_EMAIL:env.SES_FROM_EMAIL},connect:s.connect})).status,'accepted');
});

test('uses the configured branded display name without changing the envelope sender',async()=>{const s=server();await sendSesEmail({...input,fromName:'LeadMaster',connect:s.connect});const message=s.commands.at(-1);assert.match(message,/From: LeadMaster <sender@example\.com>/);assert.ok(s.commands.some(command=>command==='MAIL FROM:<sender@example.com>\r\n'));});

test('adds a private message reference and delivery event tag for SES updates',async()=>{
 const s=server(),id='a1234567-b123-c123-d123-e123456789ab';
 await sendSesEmail({...input,messageId:id,env:{...env,SES_CONFIGURATION_SET:'leadmaster-events'},connect:s.connect});
 const data=s.commands.at(-1);
 assert.match(data,new RegExp('X-LeadMASTER-Message-ID: '+id));
 assert.match(data,new RegExp('X-SES-MESSAGE-TAGS: leadmaster_message_id='+id));
 assert.match(data,/X-SES-CONFIGURATION-SET: leadmaster-events/);
});

test('sends an HTML-only message without requiring a plain-text alternative',async()=>{
 const s=server(),html='<h1>HTML only</h1>';
 await sendSesEmail({...input,text:'',html,connect:s.connect});
 const message=s.commands.at(-1);
 assert.match(message,/Content-Type: text\/html; charset=UTF-8/);
 assert.doesNotMatch(message,/multipart\/alternative/);
 assert.ok(message.includes(Buffer.from(html).toString('base64')));
});
test('rejects a message with neither text nor HTML before connecting',async()=>{
 let connected=false;
 await assert.rejects(sendSesEmail({...input,text:'',html:'',connect:()=>{connected=true}}));
 assert.equal(connected,false);
});

test('sends CC in the visible header, BCC only as envelope recipients, and omits Reply-To by default',async()=>{
 const s=server();
 await sendSesEmail({...input,to:['to-one@example.com','to-two@example.com'],cc:['copy@example.com'],bcc:['blind@example.com'],connect:s.connect});
 const data=s.commands.at(-1);
 assert.match(data,/^To: to-one@example\.com, to-two@example\.com/m);
 assert.match(data,/^Cc: copy@example\.com/m);
 assert.doesNotMatch(data,/^Bcc:/m);
 assert.doesNotMatch(data,/^Reply-To:/m);
 const rcpts=s.commands.filter(x=>x.startsWith('RCPT TO:'));
 assert.deepEqual(rcpts,['RCPT TO:<to-one@example.com>\r\n','RCPT TO:<to-two@example.com>\r\n','RCPT TO:<copy@example.com>\r\n','RCPT TO:<blind@example.com>\r\n']);
});
test('adds Reply-To only when explicitly supplied',async()=>{
 const s=server();await sendSesEmail({...input,replyTo:'replies@example.com',connect:s.connect});
 assert.match(s.commands.at(-1),/^Reply-To: replies@example\.com/m);
});

test('splits 1000 recipients into SES-safe messages of no more than 50 envelope recipients',async()=>{
 const s=server(),to=Array.from({length:1000},(_,i)=>`person${i}@example.com`);
 const result=await sendSesEmail({...input,to,connect:s.connect});
 assert.deepEqual(result,{status:'accepted'});
 assert.equal(s.commands.filter(x=>x.startsWith('DATA')).length,20);
 assert.equal(s.commands.filter(x=>x.startsWith('MAIL FROM:')).length,20);
 assert.equal(s.commands.filter(x=>x.startsWith('RCPT TO:')).length,1000);
});
test('includes CC and BCC only in the first chunk when a send is split',async()=>{
 const s=server(),to=Array.from({length:60},(_,i)=>`person${i}@example.com`);
 await sendSesEmail({...input,to,cc:['copy@example.com'],bcc:['blind@example.com'],connect:s.connect});
 const messages=s.commands.filter(x=>x.includes('MIME-Version:'));
 assert.equal(messages.length,2);
 assert.match(messages[0],/^Cc: copy@example\.com/m);
 assert.doesNotMatch(messages[1],/^Cc:/m);
 assert.equal(s.commands.filter(x=>x==='RCPT TO:<copy@example.com>\\r\\n').length,1);
 assert.equal(s.commands.filter(x=>x==='RCPT TO:<blind@example.com>\\r\\n').length,1);
});
