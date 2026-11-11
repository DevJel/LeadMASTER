import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sesSnsEvents } from '../src/ses-sns-events.mjs';

test('SES event handler requires a configured topic and rejects unsigned events', async () => {
 const request = () => new Request('https://example.test/api/aws/ses-events', {method:'POST', body:JSON.stringify({Type:'Notification',TopicArn:'unexpected'})});
 assert.equal((await sesSnsEvents(request(), {})).status, 503);
 assert.equal((await sesSnsEvents(request(), {SES_SNS_TOPIC_ARN:'expected'})).status, 403);
});
