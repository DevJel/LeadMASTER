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


test('dashboard routes and static bundles are gated by a server-validated session before asset/proxy routing', async () => {
 const worker = await read('../worker.js');
 const gate = worker.indexOf('Enforce the dashboard gate before API routing');
 const apiRouting = worker.indexOf('if (url.pathname === "/api/aws/ses-events")');
 const staticLookup = worker.indexOf('const asset = staticAssets[assetPath]');
 const upstreamProxy = worker.indexOf('const upstream = new URL(url.pathname + url.search, UPSTREAM)');
 assert.ok(gate >= 0 && gate < apiRouting && gate < staticLookup && gate < upstreamProxy, 'Session gate must run before API, static assets and upstream proxy');
 assert.match(worker, /decodeURIComponent\(url\.pathname\)/);
 assert.ok(worker.includes('const dashboardRoute = routePath === "/dashboard" || routePath.startsWith("/dashboard/") || routePath.startsWith("/dashboard.")'));
 assert.ok(worker.includes('const session = await sessionFor(request, env);'));
 assert.ok(worker.includes('if (!session) return Response.redirect(new URL("/login.html", request.url), 302);'));
 for (const path of ["/dashboard.js", "/dashboard.css", "/developer-api-keys.html", "/html-preview.js", "/html-preview.css", "/assets/vendor/dompurify.min.js"]) assert.ok(worker.includes(JSON.stringify(path)), 'Missing protected asset '+path);
});
