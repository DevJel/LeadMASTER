import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('dashboard shell persists while workspace content loads and refreshes', async () => {
  const app = await readFile(new URL('../required-componets-design/App.tsx', import.meta.url), 'utf8');
  assert.ok(app.includes('hasWorkspaceSnapshot ? mainContent : (loadError || viewError) ? ErrorState : LoadingState'));
  assert.ok(app.includes('setHasWorkspaceSnapshot(true)'));
  assert.ok(!app.includes('const LoadingState = null'));
  assert.ok(!app.includes('disabled={viewLoading && view!==item.k}'));
  assert.ok(app.includes('Retry content'));
  assert.ok(app.includes('leadmaster-full.svg'));
});

test('inbox is a single unified mailbox without category tabs or category filtering', async () => {
  const app = await readFile(new URL('../required-componets-design/App.tsx', import.meta.url), 'utf8');
  for (const removed of ['Primary','Promotions','Social','Updates','Forums','Important mail first','Deals and offers','People and updates','Receipts and alerts','Groups and threads','TABS.map','activeTab','tabUnread']) {
    assert.ok(!app.includes(removed), `Removed inbox category UI remains: ${removed}`);
  }
  assert.match(app, /e\.folder==='inbox' && !deleted\.has\(e\.id\) && !archived\.has\(e\.id\) && !snoozed\.has\(e\.id\)/);
  assert.match(app, /view==='inbox'\?'Inbox'/);
});

test('premium shell keeps centered search, transparent product logo and bottom profile/sidebar controls', async () => {
  const app = await readFile(new URL('../required-componets-design/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /src="\/assets\/brand\/leadmaster-full\.svg"/);
  assert.match(app, /md:grid-cols-\[minmax\(0,1fr\)_minmax\(280px,680px\)_minmax\(0,1fr\)\]/);
  assert.match(app, /aria-label="Open profile and settings"/);
  assert.match(app, /Profile, settings &amp; configurations/);
  assert.match(app, /Collapse sidebar/);
  assert.match(app, /aria-label="Expand sidebar"/);
  assert.doesNotMatch(app, /\{k:'settings'/);
  assert.doesNotMatch(app, /aria-label="Show or hide navigation"/);
});


test('reusable loading veil is subtle, dismissible and automatically closes when idle', async () => {
  const [app, overlay] = await Promise.all([
    readFile(new URL('../required-componets-design/App.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/dashboard-tsx/LoadingOverlay.tsx', import.meta.url), 'utf8')
  ]);
  assert.ok(app.includes('<LoadingOverlay active={loadingOverlayActive}'));
  assert.ok(overlay.includes('backdrop-blur-md'));
  assert.ok(overlay.includes('bg-black/25'));
  assert.ok(overlay.includes('aria-label="Dismiss loading overlay"'));
  assert.ok(overlay.includes('if (!active || dismissed) return null;'));
  assert.ok(overlay.includes('onClick={onDismiss}'));
  assert.ok(!overlay.includes('setTimeout') && !overlay.includes('setInterval'));
});

test('send outcomes remain truthful and uncertain sends are never labelled delivered', async () => {
  const app = await readFile(new URL('../required-componets-design/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /if\(kind==='sent'\)setSendingPhase\('unknown'\)/);
  assert.match(app, /Queue acceptance is not delivery confirmation/);
  assert.match(app, /Check Outbox before trying again/);
});


test('utility pages retain navigation and use a first-load skeleton with the shared veil', async () => {
  const [app, utilities] = await Promise.all([
    readFile(new URL('../required-componets-design/App.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../required-componets-design/UtilityApps.tsx', import.meta.url), 'utf8')
  ]);
  assert.ok(app.includes("detailState?.status === 'loading'"));
  assert.ok(utilities.includes('<header className="sticky'));
  assert.ok(utilities.includes('<LoadingOverlay active={loadingOverlayActive}'));
  assert.ok(utilities.includes('loading && lastLoaded===null'));
});

test('all retained inbox and SMTP component loading indicators use dismissible viewport overlays', async () => {
  const [inbox, smtp] = await Promise.all([
    readFile(new URL('../src/dashboard-tsx/Inbox.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/dashboard-tsx/SmtpSettings.tsx', import.meta.url), 'utf8')
  ]);
  for (const source of [inbox, smtp]) {
    assert.doesNotMatch(source, /<LoadingIndicator compact/);
    assert.match(source, /fixed inset-0 z-\[120\] grid place-items-center/);
    assert.match(source, /backdrop-blur-md/);
    assert.match(source, /aria-label="Dismiss loading overlay"/);
  }
});


test('shared overlay hides only its visual layer and never aborts an active request', async () => {
  const overlay = await readFile(new URL('../src/dashboard-tsx/LoadingOverlay.tsx', import.meta.url), 'utf8');
  assert.ok(overlay.includes('if (!active || dismissed) return null;'));
  assert.ok(overlay.includes('onClick={onDismiss}'));
  assert.ok(!overlay.includes('AbortController'));
});
