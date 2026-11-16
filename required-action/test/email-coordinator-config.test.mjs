import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));

test('production main Worker owns the shared SQLite coordinator namespace', async () => {
  const config = await read('../wrangler.jsonc');
  assert.ok(config.durable_objects.bindings.some(binding => binding.name === 'EMAIL_COORDINATOR' && binding.class_name === 'EmailCoordinator'));
  assert.deepEqual(config.exports.EmailCoordinator, { type: 'durable-object', storage: 'sqlite' });
  assert.equal(config.vars.SES_MAX_MESSAGES_PER_SECOND, '10');
});

test('production queue consumer binds to the main Worker coordinator and has no direct SMTP credentials', async () => {
  const config = await read('../wrangler.queue-consumer.jsonc');
  assert.deepEqual(config.durable_objects.bindings, [{name:'EMAIL_COORDINATOR',class_name:'EmailCoordinator',script_name:'leadmaster'}]);
  const bindings = (config.secrets_store_secrets || []).map(value => value.binding);
  assert.equal(bindings.some(name => ['SES_SMTP_HOST','SES_SMTP_USERNAME','SES_SMTP_PASSWORD'].includes(name)), false);
  assert.ok(bindings.includes('SESSION_SECRET'));
});

test('staging owns an isolated coordinator and staging consumer binds only to staging', async () => {
  const main = await read('../wrangler.staging.jsonc');
  const consumer = await read('../wrangler.staging.queue-consumer.jsonc');
  assert.equal(main.name, 'leadmaster-staging-release');
  assert.ok(main.durable_objects.bindings.some(binding => binding.name === 'EMAIL_COORDINATOR'));
  assert.deepEqual(main.exports.EmailCoordinator, { type: 'durable-object', storage: 'sqlite' });
  assert.deepEqual(consumer.durable_objects.bindings, [{name:'EMAIL_COORDINATOR',class_name:'EmailCoordinator',script_name:'leadmaster-staging-release'}]);
  assert.equal(main.d1_databases[0].database_id, '78cfdd79-cd90-4c06-9d1e-2f391a3496d1');
});
