import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('dashboard includes the authenticated operational email folders', async () => {
  const html = await readFile(new URL('../public/dashboard.html', import.meta.url), 'utf8');
  const script = await readFile(new URL('../public/dashboard.js', import.meta.url), 'utf8');
  for (const folder of ['inbox', 'sent', 'bounced', 'unsuccessful', 'unsubscribed']) {
    assert.match(script, new RegExp(folder));
  }
  assert.match(script, /\/api\/admin\/mail/);
  assert.match(script, /\/api\/admin\/send/);
  assert.match(html, /workspace-panel/);
  assert.match(html, /dashboard\.css/);
});

test('dashboard uses a restrained light grayscale responsive design', async () => {
  const css = await readFile(new URL('../public/dashboard.css', import.meta.url), 'utf8');
  assert.match(css, /background:#fff/);
  assert.match(css, /@media\(max-width:760px\)/);
  assert.match(css, /#e8e8e8/);
  assert.doesNotMatch(css, /prefers-color-scheme:\s*dark/i);
});
