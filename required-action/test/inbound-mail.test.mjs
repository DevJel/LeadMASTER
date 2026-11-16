import { test } from 'node:test';
import assert from 'node:assert/strict';
import inboundWorker from '../workers/inbound-mail.js';

function fixture({ existing = null, failBatch = false } = {}) {
  const writes = [];
  const objects = new Map();
  const deleted = [];
  const forwarded = [];
  const rejected = [];
  const db = {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            sql, args,
            async first() { return existing; }
          };
        }
      };
    },
    async batch(statements) {
      if (failBatch) throw new Error('D1 unavailable');
      writes.push(...statements);
      return statements.map(() => ({ success: true }));
    }
  };
  const bucket = {
    async put(key, value, options) { objects.set(key, { value, options }); },
    async delete(key) { deleted.push(key); objects.delete(key); }
  };
  const message = {
    to: 'app@leadmaster.jelvan.space',
    from: 'sender@example.com',
    rawSize: 35,
    raw: new Response('From: Sender <sender@example.com>\r\nSubject: Hello\r\n\r\nBody').body,
    headers: new Headers({
      from: 'Sender <sender@example.com>',
      subject: 'Hello',
      'message-id': '<message-1@example.com>'
    }),
    setReject(reason) { rejected.push(reason); },
    async forward(address, headers) { forwarded.push({ address, headers }); }
  };
  return { db, bucket, message, writes, objects, deleted, forwarded, rejected };
}

test('stores the app inbox email, records dashboard activity and forwards to the admin mailbox', async () => {
  const f = fixture();
  await inboundWorker.email(f.message, { AUTH_DB: f.db, INBOUND_MAIL: f.bucket });

  assert.equal(f.objects.size, 1);
  assert.equal(f.writes.length, 3);
  assert.match(f.writes[0].sql, /INSERT INTO inbound_mail/);
  assert.match(f.writes[1].sql, /INSERT INTO workspace_activity/);
  assert.match(f.writes[2].sql, /INSERT INTO mail_notifications/);
  assert.equal(f.writes[0].args[1], 'sender@example.com');
  assert.equal(f.writes[0].args[2], 'app@leadmaster.jelvan.space');
  assert.equal(f.writes[0].args[10], 'Sender');
  assert.equal(f.forwarded.length, 1);
  assert.equal(f.forwarded[0].address, 'admin@work.jelvan.pro');
  assert.equal(f.rejected.length, 0);
});

test('deduplicates a repeated Message-ID but still forwards the received copy', async () => {
  const f = fixture({ existing: { id: 'already-saved' } });
  await inboundWorker.email(f.message, { AUTH_DB: f.db, INBOUND_MAIL: f.bucket });
  assert.equal(f.objects.size, 0);
  assert.equal(f.writes.length, 0);
  assert.equal(f.forwarded.length, 1);
});

test('rejects messages sent to any address other than the dedicated app inbox', async () => {
  const f = fixture();
  f.message.to = 'other@leadmaster.jelvan.space';
  await inboundWorker.email(f.message, { AUTH_DB: f.db, INBOUND_MAIL: f.bucket });
  assert.equal(f.rejected.length, 1);
  assert.equal(f.objects.size, 0);
  assert.equal(f.forwarded.length, 0);
});

test('rejects messages over the configured mailbox size limit', async () => {
  const f = fixture();
  f.message.rawSize = 26 * 1024 * 1024;
  await inboundWorker.email(f.message, { AUTH_DB: f.db, INBOUND_MAIL: f.bucket });
  assert.equal(f.rejected.length, 1);
  assert.equal(f.objects.size, 0);
});

test('removes the R2 object if the D1 transaction fails', async () => {
  const f = fixture({ failBatch: true });
  await assert.rejects(
    inboundWorker.email(f.message, { AUTH_DB: f.db, INBOUND_MAIL: f.bucket }),
    /D1 unavailable/
  );
  assert.equal(f.objects.size, 0);
  assert.equal(f.deleted.length, 1);
  assert.equal(f.forwarded.length, 0);
});
