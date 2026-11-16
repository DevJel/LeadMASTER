import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const exists = async path => { try { await readFile(new URL(path, import.meta.url)); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } };

test('production main Worker owns the shared SQLite coordinator namespace', async () => {
  const config = await read('../wrangler.jsonc');
  assert.ok(config.durable_objects.bindings.some(binding => binding.name === 'EMAIL_COORDINATOR' && binding.class_name === 'EmailCoordinator'));
  assert.equal(config.d1_databases, undefined);
  assert.equal(config.vars.TURSO_URL, 'libsql://leadmaster-devjel.aws-ap-southeast-2.turso.io');
  assert.deepEqual(config.exports.EmailCoordinator, { type: 'durable-object', storage: 'sqlite' });
  assert.equal(config.vars.SES_MAX_MESSAGES_PER_SECOND, '10');
});

test('production queue consumer binds to the main Worker coordinator and has no direct SMTP credentials', async () => {
  const config = await read('../wrangler.mail-master-web-app.queue-consumer.jsonc');
  assert.deepEqual(config.durable_objects.bindings, [{name:'EMAIL_COORDINATOR',class_name:'EmailCoordinator',script_name:'leadmaster'}]);
  const bindings = (config.secrets_store_secrets || []).map(value => value.binding);
  assert.equal(bindings.some(name => ['SES_SMTP_HOST','SES_SMTP_USERNAME','SES_SMTP_PASSWORD'].includes(name)), false);
  assert.ok(bindings.includes('SESSION_SECRET'));
  assert.ok(bindings.includes('TURSO_AUTH_TOKEN'));
  assert.equal(config.vars.TURSO_URL, 'libsql://leadmaster-devjel.aws-ap-southeast-2.turso.io');
  assert.equal(config.d1_databases, undefined);
});

test('legacy D1 staging profiles are retired until a dedicated Turso staging database is provisioned', async () => {
  assert.equal(await exists('../wrangler.staging.jsonc'), false);
  assert.equal(await exists('../wrangler.staging.queue-consumer.jsonc'), false);
  assert.equal(await exists('../wrangler.staging.failed-consumer.jsonc'), false);
});
