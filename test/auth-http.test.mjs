import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('synthetic Worker HTTP authorization and persistence checks', () => {
  const loader = fileURLToPath(new URL('../scripts/http-fixtures/loader.mjs', import.meta.url));
  const cases = fileURLToPath(new URL('../scripts/http-fixtures/auth-http-cases.mjs', import.meta.url));
  const result = spawnSync(process.execPath, ['--no-warnings', '--experimental-loader', loader, '--test', cases], { encoding: 'utf8', timeout: 30000 });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});
