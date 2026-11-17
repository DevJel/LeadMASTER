import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const workerSource = readFileSync(new URL('../worker.js', import.meta.url), 'utf8');
const routeStart = workerSource.indexOf('async function adminMailboxRoute(');
const routeEnd = workerSource.indexOf('async function adminSendRoute(', routeStart);
assert.ok(routeStart >= 0 && routeEnd > routeStart, 'adminMailboxRoute source must be available');
const context = {
  Response,
  URL,
  configuredAdminEmail: async () => 'admin@example.test',
  json: (body, status = 200) => Response.json(body, { status }),
};
const route = vm.runInNewContext(
  workerSource.slice(routeStart, routeEnd) + ';adminMailboxRoute',
  context
);

function makeEnv() {
  const calls = { first: [], all: [] };
  const env = {
    INBOUND_MAIL: {},
    AUTH_DB: {
      prepare(sql) {
        const statement = {
          bind() { return this; },
          async first() { calls.first.push(sql); return { n: 7 }; },
          async all() { calls.all.push(sql); return { results: [] }; },
        };
        return statement;
      },
    },
  };
  return { env, calls };
}

async function request(path) {
  const { env, calls } = makeEnv();
  const response = await route(
    new Request('https://leadmaster.example' + path),
    env,
    { email: 'admin@example.test' }
  );
  return { response, calls };
}

test('ordinary mailbox folders do not run aggregate count scans', async () => {
  for (const folder of ['inbox', 'sent', 'deleted']) {
    const { response, calls } = await request('/api/admin/mail?folder=' + folder);
    assert.equal(response.status, 200, folder);
    assert.equal(calls.first.length, 0, folder + ' should not run COUNT queries');
    assert.equal(calls.all.length, 1, folder + ' should run only its requested list query');
  }
});

test('the dedicated counts endpoint runs the eight summary queries on demand', async () => {
  const { response, calls } = await request('/api/admin/mail?folder=counts');
  assert.equal(response.status, 200);
  assert.equal(calls.first.length, 8);
  assert.equal(calls.all.length, 0);
  const body = await response.json();
  assert.deepEqual(Object.keys(body.counts).sort(), [
    'archived', 'bounced', 'deleted', 'inbox', 'queued', 'sent', 'unsubscribed', 'unsuccessful',
  ]);
});

test('suppression list reads do not run unrelated aggregate counts', async () => {
  const { response, calls } = await request('/api/admin/unsubscribes');
  assert.equal(response.status, 200);
  assert.equal(calls.first.length, 0);
  assert.equal(calls.all.length, 1);
  const body = await response.json();
  assert.ok(Array.isArray(body.items));
});

test('manual workspace refresh performs one bounded cycle without automatic retries', () => {
  const app = readFileSync(new URL('../required-componets-design/App.tsx', import.meta.url), 'utf8');
  const start = app.indexOf('async function refreshWorkspace(){');
  const end = app.indexOf('function currentScrollTop()', start);
  assert.ok(start >= 0 && end > start, 'refreshWorkspace source must be available');
  const refresh = app.slice(start, end);
  assert.equal((refresh.match(/reloadRecords\(/g) || []).length, 1);
  assert.match(refresh, /timeoutMs:15000/);
  assert.doesNotMatch(refresh, /\bwhile\s*\(/);
  assert.doesNotMatch(refresh, /setTimeout/);
});

const productionWranglerConfig = readFileSync(new URL('../wrangler.mail-master-web-app.jsonc', import.meta.url), 'utf8');
const rootWranglerConfig = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');

test('production Wrangler configs preserve the existing SQLite EmailCoordinator export', () => {
  for (const [name, config] of [
    ['production', productionWranglerConfig],
    ['root', rootWranglerConfig],
  ]) {
    assert.match(config, /"exports"\\s*:\\s*\\{[\\s\\S]*?"EmailCoordinator"\\s*:\\s*\\{[\\s\\S]*?"type"\\s*:\\s*"durable-object"[\\s\\S]*?"storage"\\s*:\\s*"sqlite"/, name);
    assert.doesNotMatch(config, /"migrations"\\s*:/, name + ' must use declarative exports, not legacy migrations');
  }
});
