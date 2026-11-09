import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sendThroughEmailCoordinator } from '../src/email-coordinator-client.mjs';

function fakeEnv(result,status=200){
  let captured;
  const binding={
    idFromName:name=>{assert.equal(name,'ses-global');return 'global-id';},
    get:id=>{assert.equal(id,'global-id');return {fetch:async(_url,init)=>{captured={_url,init};return Response.json(result,{status});}};}
  };
  return {env:{EMAIL_COORDINATOR:binding},get:()=>captured};
}

test('submits to one global coordinator with stable message ID and omits null fields',async()=>{
  const f=fakeEnv({status:'accepted'});
  const options={id:'123e4567-e89b-12d3-a456-426614174000',messageId:'123e4567-e89b-12d3-a456-426614174000',to:'to@example.com',subject:'Hello',text:'Body',fromEmail:null,fromName:'LeadMASTER',replyTo:null};
  const result=await sendThroughEmailCoordinator(f.env,options);
  assert.deepEqual(result,{status:'accepted'});
  const body=JSON.parse(f.get().init.body);
  assert.equal(body.id,options.id);
  assert.equal(body.messageId,options.messageId);
  assert.equal(body.fromName,'LeadMASTER');
  assert.equal(Object.hasOwn(body,'fromEmail'),false);
  assert.equal(Object.hasOwn(body,'replyTo'),false);
});

test('maps unknown outcomes without retrying or fallback',async()=>{
  const f=fakeEnv({status:'unknown'});
  await assert.rejects(sendThroughEmailCoordinator(f.env,{id:'123e4567-e89b-12d3-a456-426614174000',to:'to@example.com',subject:'Hello',text:'Body'}),e=>e.deliveryOutcome==='unknown');
});

test('missing coordinator fails closed instead of sending directly',async()=>{
  await assert.rejects(sendThroughEmailCoordinator({}, {to:'to@example.com',subject:'Hello',text:'Body'}),e=>e.deliveryOutcome==='not_accepted');
});
