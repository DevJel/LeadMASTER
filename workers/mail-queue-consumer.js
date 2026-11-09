import { connect } from 'cloudflare:sockets';
import { sendSesEmail } from '../src/ses-smtp.mjs';
import { deliverWebhookEvent } from '../src/developer-webhooks.mjs';
import { createMailConsumer } from '../src/mail-consumer-core.mjs';

export default createMailConsumer({
 send: options => sendSesEmail({connect,...options}),
 deliverWebhook: deliverWebhookEvent,
});
