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
 assert.match(html,/id="lm-compose-send" type="submit">Send email/);
 assert.ok(html.includes('Plain-text message (optional)'));
 assert.match(html,/Use plain text, HTML, or both/);
 assert.doesNotMatch(html,/id="lm-compose-message" name="text" required/);
 assert.match(html,/label:"Campaigns"/);assert.match(html,/Saved groups and scheduling are not available yet/);
});
test('public dashboard is identical to its canonical source',async()=>{
 assert.equal(await read('../src/Mandatory LeadMASTER Dashboard.html'),await read('../public/dashboard.html'));
});

test('activity logs use readable names, details and category filters',async()=>{
 const html=await read('../src/Mandatory LeadMASTER Dashboard.html');
 const start=html.indexOf('if(n==="logs")'),end=html.indexOf('if(n==="api")',start),logs=html.slice(start,end);
 assert.ok(logs.includes('See what changed across your workspace and when.'));
 assert.ok(logs.includes('Search activity or details...'));
 assert.ok(logs.includes('children:"Activity"'));
 assert.ok(logs.includes('children:"Details"'));
 assert.ok(logs.includes('["email","Emails"]'));
 assert.ok(logs.includes('["templates","Templates"]'));
 assert.ok(logs.includes('["navigation","Navigation"]'));
 assert.ok(logs.includes('eventType:x.action'));
 assert.ok(logs.includes('Template saved'));
 assert.ok(!logs.includes('children:"Status"'));
});
