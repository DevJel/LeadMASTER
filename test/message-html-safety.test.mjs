import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('sent details expose stored HTML and never invent attachment metadata',async()=>{
 const worker=await read('worker.js'), app=await read('required-componets-design/App.tsx');
 assert.match(worker,/html_body:sent\.html_body\|\|null/);
 assert.match(worker,/html_body:devSent\.html_body\|\|null/);
 assert.doesNotMatch(app,/attachment\.pdf · 248 KB/);
 assert.doesNotMatch(app,/attachment\.pdf<\/p>/);
 assert.match(app,/j\.download_url===source\?source:undefined/);
 assert.match(app,/detailState\.status==='error'/);
});
test('email HTML preview is isolated, sanitized and fails closed',async()=>{
 const source=await read('src/dashboard-tsx/SafeEmailHtml.tsx');
 assert.match(source,/sandbox=""/);
 assert.match(source,/default-src 'none'/);
 assert.match(source,/FORBID_TAGS/);
 assert.match(source,/FORBID_ATTR/);
 assert.match(source,/HTML preview is unavailable/);
});
