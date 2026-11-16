import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL(p,import.meta.url),'utf8');
test('compose uses recipient chips, address validation and CC/BCC controls',async()=>{
 const app=await read('../required-componets-design/App.tsx');
 assert.match(app,/isValidRecipientChip/);
 assert.match(app,/function addChip/);
 assert.match(app,/function removeChip/);
 assert.match(app,/aria-label="Add recipient chip"/);
 assert.match(app,/Show Cc \/ Bcc/);
 assert.match(app,/fetch\('\/api\/admin\/send'/);
});
test('compose draft and send state are persisted through authenticated APIs',async()=>{
 const app=await read('../required-componets-design/App.tsx');
 assert.match(app,/records\.create/);
 assert.match(app,/kind:'draft'/);
 assert.match(app,/fromEmail:profileEmail/);
 assert.match(app,/credentials:'same-origin'/);
});
