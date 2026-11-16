import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('staged dashboard bundle validation runs successfully', () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const syntax = spawnSync(process.execPath, ['--check', 'scripts/check-dashboard-bundle.mjs'], { cwd: root, encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout || String(syntax.error));
  const result = spawnSync(process.execPath, ['scripts/check-dashboard-bundle.mjs'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout || String(result.error));
});
