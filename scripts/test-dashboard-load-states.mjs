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
  const loadingCard = page.locator('section[aria-label="Loading status"]');
  await page.getByRole('button', { name: 'Dismiss loading overlay' }).waitFor({ timeout: 5000 });
  const box = await loadingCard.boundingBox();
  const viewport = page.viewportSize();
  assert.ok(box && viewport && Math.abs((box.x + box.width / 2) - viewport.width / 2) < 4, 'loading card horizontally centered');
  assert.ok(box && viewport && Math.abs((box.y + box.height / 2) - viewport.height / 2) < 4, 'loading card vertically centered');
  await page.getByRole('button', { name: 'Dismiss loading overlay' }).click();
  assert.equal(await page.getByRole('button', { name: 'Dismiss loading overlay' }).count(), 0, 'dismiss hides the overlay');
  assert.ok(requestCount > 0, 'dismissal does not cancel the loading request');
  assert.equal(await page.getByText('Nothing in Inbox').isVisible(), false, 'empty state during loading');
  await page.getByRole('heading', { name: 'Workspace could not be loaded' }).waitFor({ timeout: 5000 });
  assert.equal(await page.getByText('Nothing in Inbox').isVisible(), false, 'empty state after load failure');
  fail = false;
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await page.getByText('Nothing in Inbox').waitFor({ timeout: 5000 });
  const before = requestCount;
  await page.getByRole('button', { name: 'Refresh workspace', exact: true }).click();
  await page.getByText('Refreshing and verifying workspace data', { exact: false }).first().waitFor({ timeout: 5000 });
  assert.equal(await page.getByText('Nothing in Inbox').isVisible(), true, 'last successful content stays visible during refresh');
  await page.getByText('Nothing in Inbox').waitFor({ timeout: 5000 });
  assert.equal(requestCount - before, 11, 'refresh must request one workspace snapshot');
  assert.equal(await page.getByText('LeadMASTER refreshed', { exact: true }).count(), 0);
  assert.equal(await page.getByText('Workspace refreshed from the server.', { exact: true }).count(), 0);
  assert.equal(await page.locator('header img[src="/assets/brand/leadmaster-full.svg"]').count(), 1, 'transparent LeadMASTER brand mark remains visible');
  const requestCountBeforeTabSwitch = requestCount;
  const navigation = page.locator('nav[aria-label="LeadMASTER navigation"]');
  await navigation.getByRole('button', { name: 'Sent', exact: true }).click();
  await navigation.getByRole('button', { name: 'Inbox', exact: true }).click();
  await page.getByText('Nothing in Inbox', { exact: true }).waitFor({ timeout: 5000 });
  assert.equal(requestCount, requestCountBeforeTabSwitch, 'switching tabs and returning reuses the workspace snapshot');

  const utilityPage = await browser.newPage();
  const utilityStart = requestCount;
  await utilityPage.goto(`http://127.0.0.1:${server.address().port}/dashboard.html?app=notes`, { waitUntil: 'domcontentloaded' });
  const utilityCard = utilityPage.locator('section[aria-label="Utility loading status"]');
  await utilityPage.getByRole('button', { name: 'Dismiss loading overlay' }).waitFor({ timeout: 5000 });
  const utilityBox = await utilityCard.boundingBox();
  const utilityViewport = utilityPage.viewportSize();
  assert.ok(utilityBox && utilityViewport && Math.abs((utilityBox.x + utilityBox.width / 2) - utilityViewport.width / 2) < 4, 'utility loading card horizontally centered');
  assert.ok(utilityBox && utilityViewport && Math.abs((utilityBox.y + utilityBox.height / 2) - utilityViewport.height / 2) < 4, 'utility loading card vertically centered');
  await utilityPage.getByRole('button', { name: 'Dismiss loading overlay' }).click();
  await utilityPage.getByText('No notes have been saved yet.', { exact: true }).waitFor({ timeout: 5000 });
  assert.ok(requestCount > utilityStart, 'utility overlay dismissal does not cancel its request');
  await utilityPage.close();

  const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobilePage.addInitScript(() => Object.defineProperty(document, 'visibilityState', { get: () => 'hidden' }));
  await mobilePage.goto(`http://127.0.0.1:${server.address().port}/dashboard.html`, { waitUntil: 'domcontentloaded' });
  const mobileCard = mobilePage.locator('section[aria-label="Loading status"]');
  await mobilePage.getByRole('button', { name: 'Dismiss loading overlay' }).waitFor({ timeout: 5000 });
  const mobileBox = await mobileCard.boundingBox();
  const mobileViewport = mobilePage.viewportSize();
  assert.ok(mobileBox && mobileViewport && Math.abs((mobileBox.x + mobileBox.width / 2) - mobileViewport.width / 2) < 4, 'mobile loading card horizontally centered');
  assert.ok(mobileBox && mobileViewport && Math.abs((mobileBox.y + mobileBox.height / 2) - mobileViewport.height / 2) < 4, 'mobile loading card vertically centered');
  await mobilePage.getByRole('button', { name: 'Dismiss loading overlay' }).click();
  await mobilePage.getByText('Nothing in Inbox', { exact: true }).waitFor({ timeout: 5000 });
  await mobilePage.close();

  console.log('Synthetic local dashboard: centered dismissible workspace and utility loading on desktop and mobile, error, retry, empty and single refresh passed.');
} finally {
  if (browser) await browser.close();
  await new Promise(resolveClose => server.close(resolveClose));
}
