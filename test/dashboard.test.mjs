import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
test('production dashboard mirrors the mandatory React dashboard source', async () => {
 const [canonical, deployed] = await Promise.all([read('../src/Mandatory LeadMASTER Dashboard.html'), read('../public/dashboard.html')]);
 assert.equal(deployed, canonical);
 assert.match(deployed, /id="root"/);
 assert.match(deployed, /LeadMASTER · Workspace/);
 assert.doesNotMatch(deployed, /Local preview|Sample data|maya\.chen@example\.com|12,480/);
});
test('mandatory dashboard uses authenticated production APIs for supported features', async () => {
 const html = await read('../src/Mandatory LeadMASTER Dashboard.html');
 for (const route of ['/api/auth/session','/api/account/profile','/api/admin/mail','/api/admin/activity','/api/developer/keys','/api/admin/send','/api/auth/logout']) assert.ok(html.includes(route), 'Missing production API integration: '+route);
 assert.match(html, /liveMail\.map/); assert.match(html, /api_key/);
});
test('mandatory dashboard retains responsive embedded styling and navigation components', async () => {
 const html = await read('../src/Mandatory LeadMASTER Dashboard.html');
 assert.match(html, /app-shell/); assert.match(html, /app-sidebar/); assert.match(html, /bottom-bar/); assert.match(html, /@media/); assert.match(html, /tab-link/);
});
