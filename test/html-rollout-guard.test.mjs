import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('HTML requests are fail-closed before database writes or queueing unless explicitly enabled', async()=>{
 const src=await readFile(new URL('../worker.js',import.meta.url),'utf8');
 const start=src.indexOf('async function adminSendRoute('), end=src.indexOf('const requestedName=',start);
 const guarded=src.slice(start,end);
 assert.match(guarded,/htmlBody!==null && env\.ADMIN_HTML_SEND_ENABLED!=="true"/);
 assert.match(guarded,/No message was submitted/);
 assert.doesNotMatch(guarded,/AUTH_DB\.batch|MAIL_SEND_QUEUE\.send/);
});
