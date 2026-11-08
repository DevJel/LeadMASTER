import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyTurnstile } from '../src/turnstile.mjs';
const base={token:'test-token',secret:{get:async()=> 'test-secret'},expectedHostname:'login.example.com',expectedAction:'login'};
const response = data => async (url,init) => { assert.equal(url,'https://challenges.cloudflare.com/turnstile/v0/siteverify'); assert.equal(init.method,'POST'); return {ok:true,json:async()=>data}; };
test('accepts only validated matching challenge',async()=>assert.equal(await verifyTurnstile({...base,fetcher:response({success:true,hostname:'login.example.com',action:'login'})}),true));
test('rejects hostname, action and unsuccessful challenge',async()=>{for (const data of [{success:true,hostname:'other.example.com',action:'login'},{success:true,hostname:'login.example.com',action:'signup'},{success:false,hostname:'login.example.com',action:'login'}]) assert.equal(await verifyTurnstile({...base,fetcher:response(data)}),false);});
test('fails closed when validation or secrets fail',async()=>{assert.equal(await verifyTurnstile({...base,fetcher:async()=>{throw Error('offline');}}),false);assert.equal(await verifyTurnstile({...base,secret:{get:async()=>{throw Error('unavailable');}}}),false);assert.equal(await verifyTurnstile({...base,fetcher:async()=>({ok:false})}),false);});
test('rejects missing and oversized tokens before network',async()=>{let calls=0;const fetcher=async()=>{calls++;};for (const token of ['', 'x'.repeat(2049)]) assert.equal(await verifyTurnstile({...base,token,fetcher}),false);assert.equal(calls,0);});
