import test from 'node:test';
import assert from 'node:assert/strict';
import {routeHttp} from '../src/http-router.mjs';
const req = (path,method='GET') => new Request(`https://example.test${path}`,{method});
test('login config fails closed without leaking keys',async()=>{
 const r=await routeHttp(req('/api/auth/config'),{TURNSTILE_SECRET_KEY:'never-return',TURNSTILE_SITE_KEY:'site-key'});
 assert.equal(r.status,503);assert.equal(r.headers.get('cache-control'),'no-store');assert.doesNotMatch(await r.text(),/site-key|never-return/);
});
test('API methods and unknown endpoints never fall through to static assets',async()=>{
 let calls=0;const env={ASSETS:{fetch(){calls++;return new Response('unexpected')}}};
 const r=await routeHttp(req('/api/auth/config','POST'),env);assert.equal(r.status,405);assert.equal(r.headers.get('allow'),'GET');
 for (const p of ['/api','/api/auth/login','/api/auth/verify','/api/anything']) assert.equal((await routeHttp(req(p),env)).status,404);
 assert.equal(calls,0);
});
test('static assets are forwarded and protected; private page not cached',async()=>{
 const env={ASSETS:{fetch:async r=>new Response(new URL(r.url).pathname,{headers:{'content-type':'text/html'}})}};
 let r=await routeHttp(req('/login.html'),env);assert.equal(await r.text(),'/login.html');assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('x-robots-tag'),'noindex, nofollow');assert.equal(r.headers.get('x-content-type-options'),'nosniff');
 r=await routeHttp(req('/robots.txt'),env);assert.equal(r.status,200);
});
test('unsupported asset methods and missing bindings fail closed',async()=>{
 assert.equal((await routeHttp(req('/login.html','POST'),{})).status,405);
 assert.equal((await routeHttp(req('/'),{})).status,503);
 assert.equal((await routeHttp(req('/'),{ASSETS:{fetch(){throw Error('do not leak')}}})).status,503);
});
