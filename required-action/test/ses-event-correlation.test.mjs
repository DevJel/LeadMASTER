import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSesEventCorrelation } from '../src/ses-event-correlation.mjs';

const id = '12345678-1234-4123-8123-123456789abc';

test('parses the SMTP chunk suffix into its parent campaign ID', () => {
  assert.deepEqual(parseSesEventCorrelation(id + '-12'), { messageId: id, batchChunk: 12 });
});

test('leaves a normal single-message UUID unchanged', () => {
  assert.deepEqual(parseSesEventCorrelation(id), { messageId: id, batchChunk: null });
});

test('does not strip non-numeric or malformed suffixes', () => {
  assert.deepEqual(parseSesEventCorrelation(id + '-abc'), { messageId: id + '-abc', batchChunk: null });
  assert.deepEqual(parseSesEventCorrelation('not-a-uuid-12'), { messageId: 'not-a-uuid-12', batchChunk: null });
});
