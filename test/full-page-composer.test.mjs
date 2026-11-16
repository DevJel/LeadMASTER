import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL(path,import.meta.url),'utf8');

test('compose page submits through the authenticated production send queue',async()=>{
 const app=await read('../required-componets-design/App.tsx');
 assert.match(app,/view==='compose'/);
 assert.match(app,/fetch\('\/api\/admin\/send'/);
 assert.match(app,/credentials:'same-origin'/);
 assert.match(app,/setBusy\(true\)/);
 assert.match(app,/Queue acceptance is not delivery confirmation/);
 assert.match(app,/Save Draft/);
 assert.match(app,/Schedule Send/);
 assert.match(app,/showComposePreview/);
});

test('public dashboard is identical to its canonical source',async()=>{
 assert.equal(await read('../src/Mandatory LeadMASTER Dashboard.html'),await read('../public/dashboard.html'));
});
