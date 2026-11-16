import { sendThroughEmailCoordinator } from '../src/email-coordinator-client.mjs';
import { deliverWebhookEvent } from '../src/developer-webhooks.mjs';
import { createMailConsumer } from '../src/mail-consumer-core.mjs';
import { withTursoDatabase } from '../src/turso-database.mjs';

const consumer = createMailConsumer({
  send: options => sendThroughEmailCoordinator(options.env, options),
  deliverWebhook: deliverWebhookEvent,
});

export default {
  async queue(batch, env) {
    return consumer.queue(batch, await withTursoDatabase(env));
  }
};
