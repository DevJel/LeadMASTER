import { sendThroughEmailCoordinator } from '../src/email-coordinator-client.mjs';
import { deliverWebhookEvent } from '../src/developer-webhooks.mjs';
import { createMailConsumer } from '../src/mail-consumer-core.mjs';

export default createMailConsumer({
  send: options => sendThroughEmailCoordinator(options.env, options),
  deliverWebhook: deliverWebhookEvent,
});
