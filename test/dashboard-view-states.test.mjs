import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('workspace loading and error states precede dashboard content', async () => {
  const app = await readFile(new URL('../required-componets-design/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /isLoading \|\| viewLoading \? LoadingState : loadError \|\| viewError \? ErrorState : mainContent/);
  assert.match(app, /const loaded = await retryCurrentView\(\); setStatus\(loaded \?/);
});
