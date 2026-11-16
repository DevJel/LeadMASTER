import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
const guidePaths = [
  'docs/features/01-authentication-and-routing.md',
  'docs/features/02-dashboard-and-utilities.md',
  'docs/features/03-inbound-mail.md',
  'docs/features/04-outbound-email-and-queue.md',
  'docs/features/05-delivery-events-and-suppression.md',
  'docs/features/06-account-api-and-keys.md',
  'docs/features/07-webhooks.md',
  'docs/features/08-workspace-records-templates-preview.md',
  'docs/features/09-ai-reply-assistance.md',
  'docs/features/10-activity-notifications.md',
  'docs/features/11-errors-and-security.md',
  'docs/features/12-operations-and-auto-heal.md',
  'docs/features/13-mcp-automation-and-scheduling.md',
  'docs/features/14-android-assets-and-release.md'
];

test('feature index links every engineering guide', async () => {
  const index = await read('docs/FEATURES.md');
  assert.match(index, /Cross-system architecture/);
  assert.match(index, /~~~mermaid/);
  for (const path of guidePaths) {
    assert.ok(index.includes(path.replace('docs/', '')), 'Missing feature guide link: ' + path);
    await access(new URL('../' + path, import.meta.url));
  }
});

test('every feature guide documents a Mermaid flow and an explicit implementation status', async () => {
  for (const path of guidePaths) {
    const guide = await read(path);
    assert.ok(guide.includes('~~~mermaid'), path + ' needs a Mermaid diagram');
    assert.ok(guide.includes('**Status:**'), path + ' needs an implementation status');
    assert.ok(guide.includes('## Source'), path + ' needs source references');
  }
});

test('dashboard feature map points to the central feature index and canonical route', async () => {
  const map = await read('src/dashboard-feature-map.md');
  assert.ok(map.includes('docs/FEATURES.md'));
  assert.ok(map.includes('**Canonical browser route:** `/dashboard`'));
});
