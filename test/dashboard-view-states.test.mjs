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
