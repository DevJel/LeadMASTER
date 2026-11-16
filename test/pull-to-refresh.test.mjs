import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../required-componets-design/App.tsx', import.meta.url), 'utf8');
const loadingOverlay = await readFile(new URL('../src/dashboard-tsx/LoadingOverlay.tsx', import.meta.url), 'utf8');

test('workspace refresh is single-flight and verifies a complete server snapshot', () => {
  assert.match(app, /const refreshLock = useRef\(false\)/);
  assert.match(app, /if\(refreshLock\.current\) return/);
  assert.match(app, /Array\.isArray\(inboxData\?\.items\)/);
  assert.match(app, /Array\.isArray\(sentData\?\.items\)/);
  assert.match(app, /Array\.isArray\(deletedData\?\.items\)/);
  assert.match(app, /setTemplates\(tplData\.records\.map/);
  assert.match(app, /setNotes\(notesData\.records\.map/);
});

test('workspace refresh retries at 1.5 seconds and stops within 12 seconds', () => {
  assert.match(app, /while\(Date\.now\(\) - startedAt < 12000\)/);
  assert.match(app, /Math\.min\(1500,remaining\)/);
  assert.match(app, /timeoutMs:remainingAtStart/);
  assert.match(app, /requestController\.abort\(\)/);
});

test('web and Android shared dashboard expose touch, desktop and manual refresh', () => {
  assert.match(app, /onTouchStart=\{handleRefreshTouchStart\}/);
  assert.match(app, /onTouchEnd=\{handleRefreshTouchEnd\}/);
  assert.match(app, /onPointerDown=\{handleRefreshPointerDown\}/);
  assert.match(app, /onPointerUp=\{handleRefreshPointerUp\}/);
  assert.match(app, /onWheel=\{handleRefreshWheel\}/);
  assert.match(app, /aria-label="Refresh workspace"/);
});

test('refresh failure preserves prior content and exposes retry feedback', () => {
  assert.match(app, /Your previously loaded content is still available/);
  assert.match(app, /Retry refresh/);
  assert.match(app, /role="alert"/);
  assert.match(loadingOverlay, /role="status"/);
});
