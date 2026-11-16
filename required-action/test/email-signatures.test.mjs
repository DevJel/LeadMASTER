import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withSenderSignature } from '../src/email-signatures.mjs';

test('Jelvan sender gets the Jelvan signature in both MIME alternatives', () => {
  const result = withSenderSignature({fromEmail:'hello@work.jelvan.pro',text:'Hello',html:'<p>Hello</p>'});
  assert.match(result.text,/Jelvan Ricolcol/);
  assert.match(result.html,/data-leadmaster-signature="jelvan"/);
  assert.doesNotMatch(result.html,/OPERAVA Global Solutions/);
});

test('OPERAVA sender gets the company signature in both MIME alternatives', () => {
  const result = withSenderSignature({fromEmail:'hello@operavaglobal.com',text:'Hello'});
  assert.match(result.text,/OPERAVA Global Solutions/);
  assert.match(result.html,/data-leadmaster-signature="operava"/);
  assert.match(result.html,/www\.operavaglobal\.com/);
  assert.doesNotMatch(result.text,/Jelvan Ricolcol/);
});

test('plain-text-only messages are upgraded to multipart-ready HTML and keep text', () => {
  const result = withSenderSignature({fromEmail:'hello@work.jelvan.pro',text:'Hello <team>\nNext line'});
  assert.match(result.text,/Hello <team>/);
  assert.match(result.html,/Hello &lt;team&gt;/);
  assert.match(result.html,/<br>/);
  assert.match(result.html,/data-leadmaster-signature="jelvan"/);
});

test('unknown senders are not given an invented signature', () => {
  const message={fromEmail:'other@example.com',text:'Hello'};
  assert.deepEqual(withSenderSignature(message),message);
});

test('signature application is idempotent', () => {
  const once=withSenderSignature({fromEmail:'hello@operavaglobal.com',text:'Hello'});
  const twice=withSenderSignature(once);
  assert.equal(twice.text,once.text);
  assert.equal(twice.html,once.html);
});
