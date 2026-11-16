import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('synthetic Worker HTTP authorization and persistence checks', () => {
  const loader = fileURLToPath(new URL('../scripts/http-fixtures/loader.mjs', import.meta.url));
  const cases = fileURLToPath(new URL('../scripts/http-fixtures/auth-http-cases.mjs', import.meta.url));
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT; // Child must start its own test runner.
  const result = spawnSync(process.execPath, ['--no-warnings', '--experimental-loader', loader, '--test', cases], { encoding: 'utf8', timeout: 30000, env });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});
