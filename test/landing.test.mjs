import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const page=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
test('landing uses the original full logo and favicon',()=>{assert.match(page,/assets\/brand\/leadmaster-full\.svg/);assert.match(page,/assets\/brand\/favicon-gray\.svg/);});
test('sign-in links use existing login page',()=>{const links=[...page.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];const signIns=links.filter(m=>/log in|sign in|open workspace/i.test(m[2]));assert.ok(signIns.length>=4);for(const link of signIns)assert.equal(link[1],'./login.html');});
test('landing describes unavailable capabilities accurately',()=>{assert.match(page,/Secure sign-in and email sending are not available yet/);assert.match(page,/public email API is planned but has not been implemented/);assert.doesNotMatch(page,/2,400\+|LIVE DEMO|lm_live_|hello@leadmaster\.io/);});
test('tab controls point to existing panels',()=>{const tabs=[...page.matchAll(/aria-controls="(panel-[^"]+)"/g)];assert.equal(tabs.length,6);for(const [,id] of tabs)assert.ok(page.includes(`id="${id}"`));});
test('landing uses only on-site documentation links',()=>{assert.doesNotMatch(page,/github\.com/i);assert.match(page,/\.\/docs\.html#overview/);assert.match(page,/\.\/docs\.html#api/);assert.match(page,/\.\/docs\.html#queue/);});
test('landing and login both load shared halftone behavior',async()=>{const login=await readFile(new URL('../public/login.html',import.meta.url),'utf8');assert.match(page,/src="\.\/halftone\.js"/);assert.match(login,/src="\.\/halftone\.js"/);assert.match(login,/data-halftone="login"/);assert.doesNotMatch(login,/feature-card|One place for every message/);});

test('requested moments and searchable documentation are present and identified as concepts',()=>{assert.match(page,/Watch it work,<br>before you try it\./);assert.match(page,/Start in minutes\.<br>Ship in an afternoon\./);assert.match(page,/Illustrative graphics, not real metrics/);assert.equal((page.match(/data-doc-card /g)||[]).length,4);assert.match(page,/id="docs-search"/);assert.doesNotMatch(page,/id="moments-motion"/);});
