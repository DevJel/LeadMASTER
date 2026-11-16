import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const app=await readFile(new URL('../required-componets-design/App.tsx',import.meta.url),'utf8');

test('mail search and refresh operate on the connected mailbox',()=>{
 assert.match(app,/Search leads &amp; mail|Search leads & mail/);
 assert.match(app,/reloadRecords\(\)/);
 assert.match(app,/api\/admin\/mail\?folder=inbox/);
 assert.match(app,/api\/admin\/mail\?folder=sent/);
});

test('mail actions report failures and reload authoritative state',()=>{
 assert.match(app,/Could not archive this message/);
 assert.match(app,/Could not move this message to Deleted/);
 assert.match(app,/Could not restore this message/);
 assert.match(app,/await reloadRecords\(\)/);
});
