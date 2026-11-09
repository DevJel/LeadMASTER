import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL(path,import.meta.url),'utf8');
test('composer is a page rather than a modal and submits to the existing authenticated endpoint',async()=>{
 const html=await read('../src/Mandatory LeadMASTER Dashboard.html');
 assert.match(html,/id="lm-compose-page"/);assert.doesNotMatch(html,/<dialog id="lm-live-compose"/);
 assert.match(html,/window\.lmOpenComposer/);assert.match(html,/fetch\('\/api\/admin\/send'/);
 for(const field of ['lm-compose-to','lm-compose-from','lm-compose-name','lm-compose-subject','lm-compose-message','lm-compose-status'])assert.ok(html.includes(field));
 assert.match(html,/The sending result could not be confirmed/);assert.match(html,/send\.disabled=uncertain/);
 assert.match(html,/label:"Campaigns"/);assert.match(html,/Saved groups and scheduling are not available yet/);
});
test('public dashboard is identical to its canonical source',async()=>{
 assert.equal(await read('../src/Mandatory LeadMASTER Dashboard.html'),await read('../public/dashboard.html'));
});
