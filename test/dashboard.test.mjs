// Production React workspace integration checks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('production asset build emits compiled Tailwind utilities and app bundle', async () => {
 const [css,js]=await Promise.all([read('../public/dashboard-app.css'),read('../public/dashboard-app.js')]);
 assert.ok(css.length>10000,'Tailwind utility CSS was not generated');
 assert.match(css,/\.min-h-screen/);
 assert.match(css,/\.rounded-2xl/);
 assert.doesNotMatch(css,/@tailwind\s+(?:base|components|utilities)/);
 assert.ok(js.length>10000,'React application bundle was not generated');
});

test('production dashboard mounts the required React workspace and generated mirror', async () => {
 const [canonical, deployed] = await Promise.all([read('../src/Mandatory LeadMASTER Dashboard.html'), read('../public/dashboard.html')]);
 assert.equal(deployed, canonical);
 assert.match(canonical, /id="root"/);
 assert.match(canonical, /dashboard-app\.js/);
 assert.match(canonical, /dashboard-app\.css/);
 assert.match(canonical, /LeadMASTER · Workspace/);
});

test('required design uses authenticated production mailbox and send endpoints', async () => {
 const app = await read('../required-componets-design/App.tsx');
 for (const route of ['/api/workspace/actions','/api/admin/mail?folder=inbox','/api/admin/mail?folder=sent','/api/admin/mail?folder=deleted','/api/admin/send']) {
  assert.ok(app.includes(route), 'Missing production integration: '+route);
 }
 assert.match(app, /credentials:'same-origin'/);
 assert.match(app, /Queue acceptance is not delivery confirmation/);
 assert.match(app, /delivery_status/);
 assert.match(app, /records\.create/);
 assert.match(app, /records\.replace/);
 assert.match(app, /records\.delete/);
});

test('mailbox actions use authoritative API operations instead of local-only state', async () => {
 const app = await read('../required-componets-design/App.tsx');
 assert.match(app, /async function openMessage/);
 assert.match(app, /patchMail\(id,'archive'/);
 assert.match(app, /patchMail\(id,'delete'/);
 assert.match(app, /patchMail\(id,'restore'/);
 assert.match(app, /patchMail\(id,'permanentDelete'/);
 assert.match(app, /\/api\/admin\/mail\/.*\/suggest/);
});

test('dashboard JavaScript and CSS remain protected by the clean page route gate', async () => {
 const [worker, routes] = await Promise.all([read('../worker.js'), read('../src/page-routes.mjs')]);
 assert.match(routes, /"\\/dashboard-app\\.js"/);
 assert.match(routes, /"\\/dashboard-app\\.css"/);
 assert.match(worker, /resolvePageRoute\\(routePath\\)/);
 assert.match(worker, /if \\(pageRoute\\.requiresSession\\)/);
 assert.match(worker, /isProtectedPageAsset\\(routePath\\)/);
});

test('design CSS retains the monochrome palette and responsive workspace layout', async () => {
 const css = await read('../required-componets-design/index.css');
 assert.match(css, /--bg:#FFFFFF/);
 assert.match(css, /--text:#2B2B2B/);
 assert.match(css, /prefers-reduced-motion/);
 assert.match(css, /color-scheme:light/);
 const app = await read('../required-componets-design/App.tsx');
 assert.match(app, /<aside/);
 assert.match(app, /<main/);
 assert.match(app, /md:hidden/);
 assert.doesNotMatch(app, /rightPanel/);
 assert.ok(css.includes('html,body,#root{height:100%;min-height:0;overflow:hidden}'));
 assert.ok(css.includes('.lm-main-scroll{height:100%;min-height:0;overflow-y:auto'));
});

test('Android companion keeps the authenticated responsive dashboard as its single source', async () => {
 const [activity, gradle, workspace] = await Promise.all([
  read('../ANDROID APK/app/src/main/java/pro/leadmaster/app/MainActivity.kt'),
  read('../ANDROID APK/app/build.gradle.kts'),
  read('../ANDROID APK/app/src/main/java/pro/leadmaster/app/WorkspaceViewModel.kt')
 ]);
 assert.ok(activity.includes('WorkspaceWebView'));
 assert.ok(activity.includes('CookieManager.getInstance().flush()'));
 assert.ok(workspace.includes('APP_HOST = "leadmaster.jelvan.space"'));
 assert.ok(gradle.includes('minSdk = 26'));
});
