# LeadMASTER Developer Email & Webhooks API

> **Public documentation hub:** [LeadMASTER landing page → Documentation](https://leadmaster.jelvan.pro/#documentation). This file is the repository's detailed engineering reference; the public product guide is maintained in the landing page, not on a separate public documentation site.


Base URL: `https://leadmaster.jelvan.pro`

LeadMASTER provides a server-to-server email API and signed webhooks. Create a separate API key for each application/environment, store it in a server-side secret manager, and never expose it in browser code, a mobile bundle, source control or client-side HTML.

> **Release status:** LeadMASTER's account-scoped API routes are implemented in this branch. Controlled authenticated email and webhook callback end-to-end tests remain outstanding; a successful route check is not proof of inbox delivery.


## 1. Account identity and isolation

Every integration is owned by a LeadMASTER account. The account identifier is opaque and is generated for the authenticated account; it is not a credential. Obtain it from the authenticated workspace session, API Keys page or API-key creation response. Never guess or reuse another user's account ID.

Account information endpoint (requires an API key belonging to the same account):

`GET /api/v1/accounts/{account_id}`

The response includes the current account name, ID and account-owned endpoint paths. Every API key stores its account ownership. Email requests, webhooks, signing secrets and delivery records are constrained to that account and API key. A key from another account cannot access those resources. Legacy unscoped routes are unsupported; use only the account-specific endpoints below.

The current authentication rollout supports one configured administrator identity. Self-service registration, team invitations and multi-member account management are not yet available; do not assume that feature set exists.

## 2. Create a developer API key

1. Sign in to LeadMASTER and open **API Keys**.
2. Generate a named key for the integration.
3. Select the least-privilege scopes:
   - `email:send` — submit email.
   - `email:read` — read status for messages submitted with that key.
   - `webhook:manage` — create, list and revoke webhook subscriptions and read delivery logs.
4. Copy the key immediately. LeadMASTER stores a SHA-256 hash and short prefix; the full API key cannot be retrieved later.
5. Use a different key per app and environment. Revoke exposed or retired keys.

Key format: `lm_live_<random-secret>`.

## 3. Configure your application

Set the key in the server environment, for example:

```bash
LEADMASTER_ACCOUNT_ID="acct_replace_with_your_account_id"
LEADMASTER_API_KEY="lm_live_replace_with_your_key"
```

Do not use browser-exposed names such as `NEXT_PUBLIC_*` or `VITE_*`.

## 4. Send an email

`POST /api/v1/accounts/{account_id}/emails`

Headers: `Authorization: Bearer <key>`, `Content-Type: application/json`, and a stable `Idempotency-Key` (16–128 characters).

```json
{
  "to": "recipient@example.com",
  "subject": "Your order confirmation",
  "text": "Thanks for your order.",
  "html": "<h1>Thank you</h1><p>Your order is being processed.</p>",
  "sender_name": "Jane Smith"
}
```

Accepted fields are `to`, `subject`, `text`, optional `html` and optional `sender_name`. One recipient is supported per API request. The sending address is generated from the account holder's full name under `leadmaster.jelvan.pro`; replies go to the registered account email. The optional `sender_name` field sets or updates the account holder's display name. API users cannot choose another sending address. Attachments, CC/BCC, multiple recipients and saved templates are not in this API contract.

### cURL

```bash
curl -X POST "https://leadmaster.jelvan.pro/api/v1/accounts/$LEADMASTER_ACCOUNT_ID/emails" \
  -H "Authorization: Bearer $LEADMASTER_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-184-confirmation" \
  --data '{"to":"recipient@example.com","subject":"Order confirmation","text":"Your order has been received."}'
```

### Node.js

```js
const response = await fetch("https://leadmaster.jelvan.pro/api/v1/accounts/$LEADMASTER_ACCOUNT_ID/emails", {
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
    "https://leadmaster.jelvan.pro/api/v1/accounts/$LEADMASTER_ACCOUNT_ID/emails",
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

## 5. Read email request status

`GET /api/v1/accounts/{account_id}/emails/{id}` requires `email:read`. A key can read only requests created using that same key.

Statuses:
- `sending` — the request is waiting in the sending list or is being processed.
- `accepted` — AWS SES accepted the SMTP submission.
- `failed` — the message could not be sent after the available attempts.
- `unknown` — the connection ended after transmission began; the final result is uncertain.

The response also includes `delivery_status` when AWS SES reports a later event, such as `sent`, `delivered`, `bounced`, `complaint`, `delayed`, `rejected` or `failed`. `accepted` is not proof of inbox delivery, placement or reading. Reuse the same idempotency key for retries and reconcile `unknown` outcomes before resending.


## 5A. Incoming mail and dashboard sending

The superadmin dashboard includes a dedicated inbox at **inbound@inbound.leadmaster.jelvan.pro**. Only mail sent to this exact address is captured by the new LeadMASTER receiving Worker. Existing forwarding rules for jelvan.pro and operavaglobal.com remain unchanged. Original messages are retained in a private R2 bucket; searchable message details are stored in D1. The dashboard can download the original .eml file. Individual attachment extraction is not yet available.

Dashboard sending supports up to 500 unique recipients in one request. Those messages enter the shared queue and are sent at no more than 10 per second. The account API remains one recipient per request.

The superadmin can choose hello@work.jelvan.pro, hello@operavaglobal.com or another sender address under a verified sending identity. Regular account API messages use the account holder's full name as the display name and the registered account email as Reply-To.

AWS SES delivery events are published through a separate LeadMASTER configuration set and SNS destination. The dashboard reports sending, delivery, bounce, complaint, delay and rejection updates. These SES updates are separate from developer webhook events.

## 6. Webhooks

Webhooks notify your backend when an email submission reaches a terminal submission outcome. Create a key with the `webhook:manage` scope, then register your HTTPS endpoint.

### Create a webhook

`POST /api/v1/accounts/{account_id}/webhooks`

```bash
curl -X POST "https://leadmaster.jelvan.pro/api/v1/accounts/$LEADMASTER_ACCOUNT_ID/webhooks" \
  -H "Authorization: Bearer $LEADMASTER_API_KEY" \
  -H "Content-Type: application/json" \
  --data '{
    "name":"Storefront email events",
    "url":"https://api.example.com/hooks/leadmaster",
    "events":["email.accepted","email.failed","email.unknown"]
  }'
```

The response includes a `signing_secret` exactly once. Copy it into your server's secret manager. LeadMASTER protects stored signing secrets with application encryption; do not put them in client code or logs.

Supported events:
- `email.accepted` — the downstream email provider accepted the submission.
- `email.failed` — the email provider did not accept the submission.
- `email.unknown` — the submission outcome could not be determined.

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

- `GET /api/v1/accounts/{account_id}/webhooks` — list subscriptions for the API key.
- `DELETE /api/v1/accounts/{account_id}/webhooks/{id}` — revoke a subscription.
- `GET /api/v1/accounts/{account_id}/webhooks/{id}/deliveries` — inspect the latest 50 delivery attempts.

A webhook URL must use HTTPS and cannot contain URL credentials. Literal IP addresses and local/internal hostnames are rejected, but validation does not pin DNS answers or guarantee protection from DNS rebinding. Register only callback hosts you control and prevent them from resolving or rebinding to private network addresses. LeadMASTER sends a POST with redirects disabled and a seven-second timeout. Each matching event currently receives one delivery attempt; non-2xx responses and network errors are recorded as unsuccessful. Automatic retries, replay controls, dead-letter recovery and delivery guarantees are not yet implemented. Your endpoint should respond quickly with a 2xx status and process work asynchronously. Treat event delivery as at-least-once from your application's perspective and deduplicate by event ID.

Delivery events describe email submission outcomes only. They are not SES bounce, complaint, unsubscribe, open or click events.

## 7. Errors and operational semantics

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
| 502 | the email provider did not accept the submission |
| 202 | submission outcome unknown |
| 503 | Required service configuration unavailable |

## 8. Security and release requirements

- Keep API keys and webhook secrets server-side; redact Authorization and signature headers in logs.
- Use one key per application/environment and minimum scopes.
- Use TLS, validate event signatures and timestamps, deduplicate event IDs, and return 2xx promptly.
- Rotate keys by deploying a replacement before revoking the old key.
- Validate consent and suppression in your application before sending.
- Account quotas and inbox delivery are separate operational checks. A configured sender identity does not replace a LeadMASTER-specific delivery test.
- Do not assume attachments, bulk campaigns, scheduled sends, retries, bounce events or delivery analytics are available.

## 9. Release checklist

The account-scoped changes in this branch are not yet a production release. Apply the migration in a controlled release, run cross-account tests, verify account-owned key creation and revocation, submit a controlled message to an approved test mailbox, register a controlled HTTPS callback, validate signatures and inspect account-owned delivery history. Do not claim verified inbox delivery or fully tested webhook callbacks until these checks pass.


## Agent security boundary

Agents must use the current user's account identifier and account-bound key only. Never use internal operator access, a shared/platform-wide key, another user's account ID, or infrastructure/provider credentials. Human login security verification and OTP are not agent authentication. MCP is not deployed in production; no MCP URL or tools should be assumed. Any future MCP tools must derive account context from their authenticated principal and enforce the same account ownership checks as REST.
