import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read = name => readFile(new URL('../public/'+name, import.meta.url),'utf8');
const section = (html,id) => {
  const found = html.match(new RegExp('<section class="doc-reference-section" id="'+id+'"[^>]*>([\\s\\S]*?)</section>'));
  assert.ok(found, 'missing '+id); return found[1];
};
test('Help Center links to actual public guides and correct support', async () => {
  const help=await read('help-center.html'), landing=await read('index.html');
  for (const id of ['doc-overview','doc-queue','doc-api','doc-webhooks','doc-mcp']) {
    assert.ok(help.includes('href="/#'+id+'"')); section(landing,id);
  }
  assert.ok(help.includes('mailto:cs@leadmaster.jelvan.space'));
});
test('public guides do not promote unavailable integrations or hide webhook limitations', async () => {
  const landing=await read('index.html');
  assert.match(section(landing,'doc-overview'),/External SMTP sender connections/);
  assert.match(section(landing,'doc-overview'),/Not currently available/);
  assert.match(section(landing,'doc-mcp'),/not currently available/);
  assert.match(section(landing,'doc-webhooks'),/DNS rebinding/);
  assert.match(section(landing,'doc-webhooks'),/HMAC-SHA256/);
  assert.match(section(landing,'doc-api'),/LEADMASTER_EMAIL_ENDPOINT/);
  for (const id of ['doc-overview','doc-auth','doc-operations','doc-queue','doc-roadmap']) {
    assert.doesNotMatch(section(landing,id),/AWS|Cloudflare|Wrangler|Siteverify|ADMIN_JWT_TOKEN|Operava/i);
  }
});
