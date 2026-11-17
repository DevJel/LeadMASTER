import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../required-componets-design/App.tsx', import.meta.url), 'utf8');
const loadingOverlay = await readFile(new URL('../src/dashboard-tsx/LoadingOverlay.tsx', import.meta.url), 'utf8');

test('workspace refresh is single-flight and verifies a complete server snapshot', () => {
  assert.match(app, /const refreshLock = useRef\(false\)/);
  assert.match(app, /if\(refreshLock\.current\\s*\\|\\|/);
  assert.match(app, /Array\.isArray\(inboxData\?\.items\)/);
  assert.match(app, /Array\.isArray\(sentData\?\.items\)/);
  assert.match(app, /Array\.isArray\(deletedData\?\.items\)/);
  assert.match(app, /setTemplates\(tplData\.records\.map/);
  assert.match(app, /setNotes\(notesData\.records\.map/);
});

test('workspace refresh performs one bounded read and only retries on a new user action', () => {
  const start = app.indexOf('async function refreshWorkspace(){');
  const end = app.indexOf('function currentScrollTop()', start);
  assert.ok(start >= 0 && end > start);
  const refresh = app.slice(start, end);
  assert.equal((refresh.match(/reloadRecords\(/g) || []).length, 1);
  assert.match(refresh, /timeoutMs:15000/);
  assert.doesNotMatch(refresh, /\\bwhile\\s*\\(/);
  assert.doesNotMatch(refresh, /setTimeout/);
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
