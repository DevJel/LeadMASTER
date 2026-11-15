import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { staticAssets } from '../src/static-assets.mjs';

test('unintegrated supplied dashboard reference is not served as a static asset', async () => {
  const build = await readFile(new URL('../scripts/build-static-assets.mjs', import.meta.url), 'utf8');
  assert.ok(!build.includes('design-reference/2026-11-16-dashboard'));
  assert.ok(!Object.keys(staticAssets).some(path => path.includes('design-reference/2026-11-16-dashboard')));
});
