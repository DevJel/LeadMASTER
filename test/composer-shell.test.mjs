import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
test('composer retains the dashboard shell and offers the existing controls',async()=>{
 const html=await readFile(new URL('../src/Mandatory LeadMASTER Dashboard.html',import.meta.url),'utf8');
 assert.match(html,/main\.appendChild\(page\)/);assert.match(html,/lm-compose-open \.app-scroll>\.content-inner/);
 assert.doesNotMatch(html,/lm-compose-open #root/);assert.match(html,/id="lm-compose-close"[^>]*>← View emails/);
 assert.match(html,/id="lm-import-files"/);assert.match(html,/id="lm-template-insert"/);assert.match(html,/id="lm-html-toggle"/);
 assert.match(html,/Discard this message and switch tabs/);assert.match(html,/Queue acceptance does not mean delivery/);
});
test('public landing does not display the internal sending rate',async()=>{
 const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');assert.doesNotMatch(html,/10\s+(?:emails|messages)\s+per\s+second/i);
});

test('recipient entry validates individual chips and supports bulk paste and file progress',async()=>{
 const html=await readFile(new URL('../src/Mandatory LeadMASTER Dashboard.html',import.meta.url),'utf8');
 assert.match(html,/id="lm-recipient-box"/);
 assert.match(html,/id="lm-recipient-chips"/);
 assert.match(html,/className='lm-recipient-chip '\+\(item\.valid\?'valid':'invalid'\)/);
 assert.match(html,/event\.key===' '/);
 assert.match(html,/recipientEntry\.addEventListener\('paste'/);
 assert.match(html,/remove or correct invalid addresses before sending/i);
 assert.match(html,/Reading file '\+\(i\+1\)/);
 assert.match(html,/Invalid entries and duplicates were skipped/);
 assert.match(html,/recipientBox\.setAttribute\('aria-busy','true'\)/);
 assert.match(html,/replaceRecipients\(next\)/);
});
