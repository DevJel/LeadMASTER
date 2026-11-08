import test from 'node:test';
import assert from 'node:assert/strict';
import { routeHttp } from '../src/http-router.mjs';
import { consumeEmailBatch } from '../src/queue-batch.mjs';
import { EmailDispatchCore } from '../src/email-queue-core.mjs';
import { sendSesEmail } from '../src/ses-smtp.mjs';
class Storage { constructor(){this.m=new Map()} async get(k){return this.m.get(k)} async put(k,v){this.m.set(k,v)} async delete(k){this.m.delete(k)} async transaction(fn){return fn(this)} }
function mockSmtp(){
  let reader; const commands=[];const enc=new TextEncoder();
  const readable=new ReadableStream({start(c){reader=c;c.enqueue(enc.encode('220 ready\r\n'))}});
  const writable=new WritableStream({write(bytes){const s=new TextDecoder().decode(bytes);commands.push(s);const response=s.startsWith('EHLO')?'250 ok':s.startsWith('AUTH')?'235 ok':s.startsWith('DATA')?'354 ready':'250 ok';reader.enqueue(enc.encode(response+'\r\n'));}});
  return {commands,connect:()=>({opened:Promise.resolve(),readable,writable,close:async()=>{}})};
}
test('authenticated HTML submission flows through queue and coordinator into MIME SMTP',async()=>{
  const key='Q'.repeat(43), id='test_message_123456', messages=[], smtp=mockSmtp();
  const env={EMAIL_API_ENABLED:'true',EMAIL_API_KEY:key,EMAIL_QUEUE:{send:async body=>messages.push({body,ack(){this.acked=true},retry(){throw Error('unexpected retry')}})},SES_SMTP_HOST:'email-smtp.ap-southeast-2.amazonaws.com',SES_SMTP_USERNAME:'test',SES_SMTP_PASSWORD:'test',SES_FROM_EMAIL:'sender@example.test'};
  const body={to:'recipient@example.test',subject:'Your code',text:'Code: 123456',html:'<p>Code: <strong>123456</strong></p>'};
  const response=await routeHttp(new Request('https://example.test/api/v1/emails',{method:'POST',headers:{authorization:'Bearer '+key,'content-type':'application/json','idempotency-key':id},body:JSON.stringify(body)}),env);
  assert.equal(response.status,202);assert.deepEqual(await response.json(),{id,status:'queued'});
  const core=new EmailDispatchCore({storage:new Storage(),send:job=>sendSesEmail({connect:smtp.connect,env,...job})});
  await consumeEmailBatch({messages},{fetch:async (_url,options)=>Response.json(await core.dispatch(JSON.parse(options.body)))});
  assert.equal(messages[0].acked,true);const data=smtp.commands.at(-1);assert.match(data,/multipart\/alternative/);assert.ok(data.includes(Buffer.from(body.html).toString('base64')));assert.ok(data.includes(Buffer.from(body.text).toString('base64')));
});
