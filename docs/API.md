# LeadMASTER Developer Email API

Base URL: `https://leadmaster.jelvan.pro`

The Developer Email API lets an application you own send transactional email through your LeadMASTER account. Generate a separate API key in the authenticated LeadMASTER workspace, store it in your application's server-side environment, and call the HTTPS API. Never place a key in browser JavaScript, a mobile app bundle, source control, or a public repository.

> **Release status:** API key management and email submission routes are implemented in the repository and the D1 schema has been created. They are not declared production-ready until the updated Worker is deployed with the `AUTH_DB` binding and SES Secrets Store bindings, and live integration tests pass. Do not issue live keys or use this API in production before that release check.

## 1. Create a developer API key

1. Sign in to LeadMASTER as the administrator.
2. Open **API Keys** in the workspace.
3. Create a key with a recognizable name, such as `Website production` or `CRM staging`.
4. Select only the scopes the integration needs:
   - `email:send` — submit email.
   - `email:read` — read status for messages submitted with that key.
5. Copy the key immediately and save it in a server-side secret manager. LeadMASTER stores only a SHA-256 hash and a short prefix; the full key is not retrievable later.
6. Create separate keys for each application and environment. Revoke a key immediately if it is exposed.

Key format: `lm_live_<random-secret>`. The prefix is an identifier, not a credential.

## 2. Configure your application

Set the key as an environment variable on your server:

```bash
LEADMASTER_API_KEY="lm_live_replace_with_your_key"
```

Do not prefix the key with `NEXT_PUBLIC_`, `VITE_`, or another browser-exposed variable name. Calls must originate from a trusted backend.

## 3. Submit an email

`POST /api/v1/emails`

Headers:

| Header | Required | Description |
| --- | --- | --- |
| `Authorization` | Yes | `Bearer lm_live_...` |
| `Content-Type` | Yes | `application/json` |
| `Idempotency-Key` | Yes | Unique 16–128 character identifier per logical send |

JSON body:

```json
{
  "to": "recipient@example.com",
  "subject": "Your order confirmation",
  "text": "Thanks for your order. We are processing it.",
  "html": "<h1>Thank you</h1><p>Your order is being processed.</p>"
}
```

Supported fields:

| Field | Type | Required | Limits |
| --- | --- | --- | --- |
| `to` | string | Yes | One valid recipient address, up to 254 characters |
| `subject` | string | Yes | Non-empty, up to 300 UTF-8 bytes; CR/LF prohibited |
| `text` | string | Yes | Non-empty, up to 200 KB |
| `html` | string | No | Non-empty when supplied, up to 200 KB |

Only the fields above are accepted. The sender address is configured by LeadMASTER and cannot be overridden by an API caller. Attachments, CC/BCC, multiple recipients, custom sender identities and templates are not part of this API contract.

### cURL

```bash
curl -X POST "https://leadmaster.jelvan.pro/api/v1/emails" \
  -H "Authorization: Bearer $LEADMASTER_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-2026-000184-confirmation" \
  --data '{
    "to":"recipient@example.com",
    "subject":"Order confirmation",
    "text":"Your order has been received.",
    "html":"<h1>Order received</h1>"
  }'
```

### JavaScript (Node.js)

```js
const response = await fetch("https://leadmaster.jelvan.pro/api/v1/emails", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.LEADMASTER_API_KEY}`,
    "Content-Type": "application/json",
    "Idempotency-Key": "order-2026-000184-confirmation"
  },
  body: JSON.stringify({
    to: "recipient@example.com",
    subject: "Order confirmation",
    text: "Your order has been received.",
    html: "<h1>Order received</h1>"
  })
});
const result = await response.json();
if (!response.ok) throw new Error(result.error || "LeadMASTER request failed");
console.log(result);
```

### Python

```python
import os
import requests

response = requests.post(
    "https://leadmaster.jelvan.pro/api/v1/emails",
    headers={
        "Authorization": f"Bearer {os.environ['LEADMASTER_API_KEY']}",
        "Content-Type": "application/json",
        "Idempotency-Key": "order-2026-000184-confirmation",
    },
    json={
        "to": "recipient@example.com",
        "subject": "Order confirmation",
        "text": "Your order has been received.",
        "html": "<h1>Order received</h1>",
    },
    timeout=20,
)
response.raise_for_status()
print(response.json())
```

## 4. Response and delivery semantics

A successful SMTP submission returns:

```json
{
  "id": "message-request-id",
  "status": "accepted",
  "message": "SES accepted the message for processing. This is not proof of inbox delivery."
}
```

`accepted` means Amazon SES accepted the SMTP message. It does not mean the recipient's mailbox accepted it, that it reached the inbox, or that it was read.

If the connection fails after the message data was transmitted, the outcome may be `unknown`. Do not generate a new idempotency key and blindly resend. Check the request status and reconcile the result first.

## 5. Read message status

`GET /api/v1/emails/{id}`

Requires a key with `email:read`. A key can read only messages submitted using that same key.

```bash
curl "https://leadmaster.jelvan.pro/api/v1/emails/MESSAGE_ID" \
  -H "Authorization: Bearer $LEADMASTER_API_KEY"
```

The status response includes the request ID, status, recipient, subject, creation/update timestamps and a safe error code where applicable. It does not expose SMTP credentials or message bodies.

Statuses:
- `sending` — request recorded and being processed.
- `accepted` — SES returned a successful SMTP acceptance response.
- `failed` — SES did not accept the message.
- `unknown` — the SMTP connection ended after message transmission began; acceptance could not be determined.

This endpoint is request/SMTP status, not a delivery-event or bounce/complaint feed. Delivery webhooks and event analytics are not currently part of this API.

## 6. Idempotency

Always send a stable `Idempotency-Key` for each logical message. Reuse the same key when retrying the same operation after a timeout. A key is unique per developer API key. Reusing it returns the previously recorded request instead of creating a second send. Do not reuse an idempotency key for different content.

## 7. Errors

| HTTP | Meaning | Recommended action |
| --- | --- | --- |
| 400 | Invalid JSON, payload or idempotency key | Correct the request |
| 401 | Missing, invalid or revoked API key | Check the server secret and key status |
| 403 | Key does not have the required scope | Create/rotate a key with the required scope |
| 405 | Unsupported HTTP method | Use the documented method |
| 415 | Content-Type is not JSON | Send `application/json` |
| 409 | Duplicate/conflicting request could not be safely accepted | Reuse the original idempotency key and inspect status |
| 502 | SES did not accept the message | Inspect request status before retrying |
| 202 | SMTP outcome is unknown | Reconcile; do not blindly resend |
| 503 | Service or required configuration unavailable | Retry later with the same idempotency key |

## 8. Security and operational guidance

- Keep API keys on trusted servers only. Never ship them to browsers or mobile clients.
- Use one key per app/environment and grant the minimum scopes.
- Rotate by creating a replacement key, deploying it, verifying it, then revoking the old key.
- Use TLS and redact Authorization headers from application logs.
- Validate user consent and suppression/opt-out status in your own application before submitting.
- Protect your own send endpoint from abuse; never expose an unauthenticated proxy to LeadMASTER.
- LeadMASTER uses its configured SES sender identity. SES account sending quotas, sandbox restrictions and sender verification still apply.
- Do not assume delivery, inbox placement, bounce processing, suppression enforcement, attachments, bulk campaigns or scheduled sending unless separately documented as released.

## 9. Platform and integration boundaries

LeadMASTER is the email transport provider in this integration. Your application remains responsible for user authentication, authorization, consent, business logic, template rendering and secure storage of its LeadMASTER API key. API keys are not end-user credentials and must not be shared among unrelated customers.

## 10. Release checklist

Before production use, verify the production Worker is deployed with the developer API module, `AUTH_DB` is bound to the `leadmaster-auth` D1 database, SES SMTP values are accessible through Secrets Store, key-management routes require an authenticated administrator session, and API calls pass live tests for accepted, failed, unknown, duplicate, revoked-key and scope-denied cases. Production docs must be updated only after those checks pass.
