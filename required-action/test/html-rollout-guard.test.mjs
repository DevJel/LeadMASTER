import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('HTML requests are accepted without requiring a plain-text alternative or a feature flag', async()=>{
 const src=await readFile(new URL('../worker.js',import.meta.url),'utf8');
 const start=src.indexOf('async function adminSendRoute('), end=src.indexOf('const requestedName=',start);
 const route=src.slice(start,end);
 assert.match(route,/(!hasText&&!hasHtml)/);
 assert.doesNotMatch(route,/ADMIN_HTML_SEND_ENABLED/);
 assert.doesNotMatch(route,/HTML sending is not enabled/);
});
