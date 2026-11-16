import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL(p,import.meta.url),'utf8');
test('composer remains a first-class workspace view and retains the designed controls',async()=>{
 const app=await read('../required-componets-design/App.tsx');
 assert.match(app,/view==='compose'/);
 assert.match(app,/aria-label="Add recipient chip"/);
 assert.match(app,/aria-label="Message body"/);
 assert.match(app,/Insert HTML/);
 assert.match(app,/showComposePreview/);
 assert.match(app,/Save Draft/);
 assert.match(app,/Schedule Send/);
 assert.match(app,/Discard this draft/);
});
test('public landing does not display the internal sending rate',async()=>{
 const html=await read('../public/index.html','utf8');assert.doesNotMatch(html,/10\s+(?:emails|messages)\s+per\s+second/i);
});
test('recipient entry validates and adds individual addresses',async()=>{
 const app=await read('../required-componets-design/App.tsx');
 assert.match(app,/isValidRecipientChip/);
 assert.match(app,/function addChip/);
 assert.match(app,/setCompose\(prev=>\(\{\.\.\.prev, to:/);
 assert.match(app,/newChip/);
});
