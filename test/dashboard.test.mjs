import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('production dashboard mirrors the mandatory React dashboard source', async () => {
 const [canonical, deployed] = await Promise.all([read('../src/Mandatory LeadMASTER Dashboard.html'), read('../public/dashboard.html')]);
 assert.equal(deployed, canonical);
 assert.match(deployed, /id="root"/);
 assert.match(deployed, /LeadMASTER · Workspace/);
 assert.doesNotMatch(deployed, /Local preview|Sample data|maya\.chen@example\.com|12,480/i);
});

test('mandatory dashboard connects live account-backed workspace features', async () => {
 const html = await read('../src/Mandatory LeadMASTER Dashboard.html');
 for (const route of ['/api/auth/session','/api/account/profile','/api/admin/mail','/api/admin/activity','/api/developer/keys','/api/admin/send','/api/admin/unsubscribes','/api/admin/webhooks','/api/auth/logout']) {
  assert.ok(html.includes(route), 'Missing production API integration: '+route);
 }
 assert.match(html, /liveMail\.map/);
 assert.match(html, /api_key_id/);
 assert.match(html, /email\.accepted/);
 assert.match(html, /webhook:manage/);
 assert.match(html, /signing_secret/);
});

test('unsupported dashboard modules do not fabricate production records', async () => {
 const html = await read('../src/Mandatory LeadMASTER Dashboard.html');
 assert.match(html, /Saved email templates are not enabled/);
 assert.match(html, /Workflow automation is unavailable/);
 assert.match(html, /Opens and clicks are not tracked/);
 assert.match(html, /DNS verification status is not available/);
 assert.doesNotMatch(html, /1,248 contacts|not-configured\.example|482 917|0\.6%/i);
});

test('mandatory dashboard retains responsive embedded styling and navigation components', async () => {
 const html = await read('../src/Mandatory LeadMASTER Dashboard.html');
 assert.match(html, /app-shell/); assert.match(html, /app-sidebar/); assert.match(html, /bottom-bar/); assert.match(html, /@media/); assert.match(html, /tab-link/);
});
