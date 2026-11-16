import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const app=await readFile(new URL('../required-componets-design/App.tsx',import.meta.url),'utf8');

test('message detail loads the actual message body and keeps errors separate',()=>{
 assert.match(app,/async function openMessage/);
 assert.match(app,/text_body/);
 assert.match(app,/setActionError/);
 assert.match(app,/Message load failed/);
 assert.match(app,/setOpenEmailId\(id\)/);
});
