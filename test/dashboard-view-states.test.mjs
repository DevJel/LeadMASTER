import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('workspace loading and error states precede dashboard content', async () => {
  const app = await readFile(new URL('../required-componets-design/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /isLoading \|\| viewLoading \? LoadingState : loadError \|\| viewError \? ErrorState : mainContent/);
  assert.match(app, /onClick=\{\(\)=>\{ void retryCurrentView\(\); \}\}/);
  assert.doesNotMatch(app, /Workspace refreshed from the server\.|LeadMASTER refreshed/);
  assert.match(app, /src="\/assets\/brand\/leadmaster-full\.svg"/);
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


test('all loading and sending states use one dismissible, viewport-centered blurred overlay', async () => {
  const app = await readFile(new URL('../required-componets-design/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /loadingOverlayActive = isLoading \|\| viewLoading \|\| isRefreshing \|\| busy \|\| Boolean\(sendingPhase\)/);
  assert.match(app, /fixed inset-0 z-\[120\] grid place-items-center/);
  assert.match(app, /backdrop-blur-md/);
  assert.match(app, /aria-label="Dismiss loading overlay"/);
  assert.match(app, /setLoadingOverlayDismissed\(true\)/);
  assert.match(app, /sendingPhase \? <SendingIndicator phase=\{sendingPhase\}\/>/);
  assert.doesNotMatch(app, /fixed bottom-4 right-4 z-\[80\]/);
  assert.doesNotMatch(app, /isRefreshing && <div role="status"/);
  assert.match(app, /const LoadingState = null/);
});

test('send outcomes remain truthful and uncertain sends are never labelled delivered', async () => {
  const app = await readFile(new URL('../required-componets-design/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /if\(kind==='sent'\)setSendingPhase\('unknown'\)/);
  assert.match(app, /Queue acceptance is not delivery confirmation/);
  assert.match(app, /Check Outbox before trying again/);
});


test('message detail and utility app loading are viewport overlays, not panel indicators', async () => {
  const [app, utilities] = await Promise.all([
    readFile(new URL('../required-componets-design/App.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../required-componets-design/UtilityApps.tsx', import.meta.url), 'utf8')
  ]);
  assert.match(app, /detailState\?\.status === 'loading'/);
  assert.doesNotMatch(app, /<LoadingIndicator compact/);
  assert.match(utilities, /loadingOverlayActive=loading\|\|saving\|\|currencyBusy\|\|aiBusy/);
  assert.match(utilities, /fixed inset-0 z-\[120\] grid place-items-center/);
  assert.match(utilities, /backdrop-blur-md/);
  assert.match(utilities, /aria-label="Dismiss loading overlay"/);
  assert.doesNotMatch(utilities, /<LoadingIndicator[^>]*compact/);
});
