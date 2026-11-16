// Synthetic local browser test only; no production account or outbound email.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { chromium } from 'playwright';

const root = resolve('public');
let fail = true;
let requestCount = 0;
const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    if (url.pathname === '/api/workspace/actions' || url.pathname === '/api/admin/mail') {
      requestCount++;
      await new Promise(resolve => setTimeout(resolve, 350));
      res.writeHead(fail ? 503 : 200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(fail ? { error: 'unavailable' } : url.pathname === '/api/workspace/actions' ? { data: { records: [] } } : { items: [] }));
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end('{}');
    return;
  }
  const file = resolve(root, url.pathname === '/' ? 'dashboard.html' : url.pathname.slice(1));
  if (!file.startsWith(root + sep)) { res.writeHead(403); res.end(); return; }
  try {
    const bytes = await readFile(file);
    const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.webp':'image/webp' };
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' });
    res.end(bytes);
  } catch { res.writeHead(404); res.end(); }
});

await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.env.LOCAL_CHROMIUM ? { executablePath: process.env.LOCAL_CHROMIUM } : {}), args: ['--no-sandbox'] });
  const page = await browser.newPage();
  // Suppress the unrelated periodic background poll so refresh request counts are deterministic.
  await page.addInitScript(() => Object.defineProperty(document, 'visibilityState', { get: () => 'hidden' }));
  await page.goto(`http://127.0.0.1:${server.address().port}/dashboard.html`, { waitUntil: 'domcontentloaded' });
  await page.getByText('Loading inbox', { exact: false }).first().waitFor({ timeout: 5000 });
  assert.equal(await page.getByText('Nothing in Inbox').isVisible(), false, 'empty state during loading');
  await page.getByRole('heading', { name: 'Something went wrong' }).waitFor({ timeout: 5000 });
  assert.equal(await page.getByText('Nothing in Inbox').isVisible(), false, 'empty state after load failure');
  fail = false;
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await page.getByText('Nothing in Inbox').waitFor({ timeout: 5000 });
  const before = requestCount;
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await page.getByText('Loading inbox', { exact: false }).first().waitFor({ timeout: 5000 });
  await page.getByText('Nothing in Inbox').waitFor({ timeout: 5000 });
  assert.equal(requestCount - before, 11, 'refresh must request one workspace snapshot');
  assert.equal(await page.getByText('LeadMASTER refreshed', { exact: true }).count(), 0);
  assert.equal(await page.getByText('Workspace refreshed from the server.', { exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Go to Inbox' }).locator('img').getAttribute('src'), '/assets/brand/leadmaster-full.svg');
  console.log('Synthetic local dashboard: loading, error, retry, empty and single refresh passed.');
} finally {
  if (browser) await browser.close();
  await new Promise(resolveClose => server.close(resolveClose));
}
