# LeadMASTER Developer Email & Webhooks API

Base URL: `https://leadmaster.jelvan.pro`

LeadMASTER provides a server-to-server email API and signed webhooks. Create a separate API key for each application/environment, store it in a server-side secret manager, and never expose it in browser code, a mobile bundle, source control or client-side HTML.

> **Release status:** The production Worker is deployed with its D1 and Secrets Store bindings. Public route checks confirm the API handlers are active. Controlled SES send and webhook callback end-to-end tests remain outstanding; a successful route check is not proof of inbox delivery.

## 1. Create a developer API key

1. Sign in to LeadMASTER and open **API Keys**.
2. Generate a named key for the integration.
3. Select the least-privilege scopes:
   - `email:send` — submit email.
   - `email:read` — read status for messages submitted with that key.
   - `webhook:manage` — create, list and revoke webhook subscriptions and read delivery logs.
4. Copy the key immediately. LeadMASTER stores a SHA-256 hash and short prefix; the full API key cannot be retrieved later.
5. Use a different key per app and environment. Revoke exposed or retired keys.

Key format: `lm_live_<random-secret>`.

## 2. Configure your application

Set the key in the server environment, for example:

```bash
LEADMASTER_API_KEY="lm_live_replace_with_your_key"
```

Do not use browser-exposed names such as `NEXT_PUBLIC_*` or `VITE_*`.

## 3. Send an email

`POST /api/v1/emails`

Headers: `Authorization: Bearer <key>`, `Content-Type: application/json`, and a stable `Idempotency-Key` (16–128 characters).

```json
{
  "to": "recipient@example.com",
  "subject": "Your order confirmation",
  "text": "Thanks for your order.",
  "html": "<h1>Thank you</h1><p>Your order is being processed.</p>"
}
```

Only `to`, `subject`, `text` and optional `html` are accepted. One recipient is supported. The sender is configured by LeadMASTER and cannot be overridden. Attachments, CC/BCC, multiple recipients, custom sender identities and templates are not in this contract.

### cURL

```bash
curl -X POST "https://leadmaster.jelvan.pro/api/v1/emails" \
  -H "Authorization: Bearer $LEADMASTER_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-184-confirmation" \
  --data '{"to":"recipient@example.com","subject":"Order confirmation","text":"Your order has been received."}'
```

### Node.js

```js
const response = await fetch("https://leadmaster.jelvan.pro/api/v1/emails", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.LEADMASTER_API_KEY}`,
    "Content-Type": "application/json",
    "Idempotency-Key": "order-184-confirmation"
  },
  body: JSON.stringify({
    to: "recipient@example.com",
    subject: "Order confirmation",
    text: "Your order has been received."
  })
});
const result = await response.json();
if (!response.ok) throw new Error(result.error || "LeadMASTER request failed");
```

### Python

```python
import os, requests

response = requests.post(
    "https://leadmaster.jelvan.pro/api/v1/emails",
    headers={
        "Authorization": f"Bearer {os.environ['LEADMASTER_API_KEY']}",
        "Content-Type": "application/json",
        "Idempotency-Key": "order-184-confirmation",
    },
    json={"to":"recipient@example.com","subject":"Order confirmation","text":"Your order has been received."},
    timeout=20,
)
response.raise_for_status()
print(response.json())
```

## 4. Read email request status

`GET /api/v1/emails/{id}` requires `email:read`. A key can read only requests created using that same key.

Statuses:
- `sending` — request recorded and being processed.
- `accepted` — SES returned a successful SMTP acceptance response.
- `failed` — SES did not accept the message.
- `unknown` — the connection ended after transmission began; acceptance is uncertain.

`accepted` is not proof of inbox delivery, reading or final recipient-server acceptance. Reuse the same idempotency key for retries and reconcile `unknown` outcomes before resending.

## 5. Webhooks

Webhooks notify your backend when an email submission reaches a terminal SMTP outcome. Create a key with the `webhook:manage` scope, then register your HTTPS endpoint.

### Create a webhook

`POST /api/v1/webhooks`

```bash
curl -X POST "https://leadmaster.jelvan.pro/api/v1/webhooks" \
  -H "Authorization: Bearer $LEADMASTER_API_KEY" \
  -H "Content-Type: application/json" \
  --data '{
    "name":"Storefront email events",
    "url":"https://api.example.com/hooks/leadmaster",
    "events":["email.accepted","email.failed","email.unknown"]
  }'
```

The response includes a `signing_secret` exactly once. Copy it into your server's secret manager. It is encrypted at rest by the Worker using the configured `SESSION_SECRET`; do not put it in client code or logs.

Supported events:
- `email.accepted` — SES accepted the SMTP submission.
- `email.failed` — SES did not accept the submission.
- `email.unknown` — the SMTP outcome could not be determined.

Webhook payload:

```json
{
  "id": "event-uuid",
  "type": "email.accepted",
  "created_at": "2026-11-09T00:00:00.000Z",
  "data": {
    "request_id": "email-request-uuid",
    "recipient": "recipient@example.com",
    "subject": "Order confirmation"
  }
}
```

### Verify the signature

Each request includes:
- `LeadMASTER-Id` — event ID.
- `LeadMASTER-Timestamp` — Unix timestamp in seconds.
- `LeadMASTER-Signature` — `v1=<hex HMAC-SHA256>`.

The signed message is the exact timestamp, a period, then the raw request body: `timestamp + "." + rawBody`. Compute HMAC-SHA256 with your webhook signing secret and compare the hex digest using a constant-time comparison. Reject stale timestamps (for example, older than five minutes), invalid signatures and duplicate event IDs. Read the raw body before JSON parsing.

Node.js verification example:

```js
import crypto from "node:crypto";

export function verifyLeadMasterWebhook(req, rawBody, secret) {
  const timestamp = req.headers["leadmaster-timestamp"];
  const header = req.headers["leadmaster-signature"] || "";
  if (!/^\\d+$/.test(String(timestamp || ""))) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = "v1=" + crypto
    .createHmac("sha256", secret)
    .update(String(timestamp) + "." + rawBody)
    .digest("hex");
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
```

### Manage subscriptions and inspect attempts

- `GET /api/v1/webhooks` — list subscriptions for the API key.
- `DELETE /api/v1/webhooks/{id}` — revoke a subscription.
- `GET /api/v1/webhooks/{id}/deliveries` — inspect the latest 50 delivery attempts.

A webhook URL must use HTTPS and cannot contain URL credentials. LeadMASTER sends a POST with redirects disabled and a seven-second timeout. Each matching event currently receives one delivery attempt; non-2xx responses and network errors are recorded as unsuccessful. Automatic retries, replay controls, dead-letter recovery and delivery guarantees are not yet implemented. Your endpoint should respond quickly with a 2xx status and process work asynchronously. Treat event delivery as at-least-once from your application's perspective and deduplicate by event ID.

Delivery events describe SMTP submission outcomes only. They are not SES bounce, complaint, unsubscribe, open or click events.

## 6. Errors and operational semantics

| HTTP | Meaning |
| --- | --- |
| 400 | Invalid JSON, payload, webhook URL or event list |
| 401 | Missing, invalid or revoked API key |
| 403 | Required scope is missing |
| 404 | Subscription or request not found for this key |
| 405 | Unsupported method |
| 415 | JSON content type required |
| 409 | Duplicate/conflicting email request |
| 429 | Per-key rate limit exceeded |
| 502 | SES did not accept the message |
| 202 | SMTP outcome unknown |
| 503 | Required service configuration unavailable |

## 7. Security and release requirements

- Keep API keys and webhook secrets server-side; redact Authorization and signature headers in logs.
- Use one key per application/environment and minimum scopes.
- Use TLS, validate event signatures and timestamps, deduplicate event IDs, and return 2xx promptly.
- Rotate keys by deploying a replacement before revoking the old key.
- Validate consent and suppression in your application before sending.
- SES sandbox status, account quotas and inbox delivery are separate operational checks. The configured sender identity `hello@work.jelvan.pro` is verified and already used by another application; this does not replace a LeadMASTER-specific delivery test.
- Do not assume attachments, bulk campaigns, scheduled sends, retries, bounce events or delivery analytics are available.

## 8. Release checklist

Deployment completed: the Worker has `AUTH_DB`, SES SMTP, sender, Turnstile, administrator and session-secret bindings; the D1 schema includes the developer API and webhook tables. The configured sender identity is verified and used by another application. Public route checks passed. Remaining release verification: use an authorized administrator session to create/revoke a scoped key, submit a controlled email to an approved test mailbox, register a controlled HTTPS webhook, validate HMAC signatures and inspect delivery logs. Until those authenticated end-to-end tests pass, do not claim verified LeadMASTER inbox delivery or fully tested webhook callbacks.
