# LeadMASTER MCP integration

## Release status

This implementation adds an account-scoped MCP Streamable HTTP endpoint to the LeadMASTER Worker. It is available only after the feature branch is merged and deployed. Until then, the production /mcp route remains unavailable.

**Endpoint after release:** https://leadmaster.jelvan.pro/mcp

MCP does not use a shared platform token or a separate MCP password. It authenticates with a LeadMASTER developer API key created in the user's own account. The key's account ID and scopes determine the tools exposed to that MCP client.

## Connect a client

1. Sign in to the intended LeadMASTER account.
2. Open **API Keys** and create a separate key for the MCP client.
3. Select only the scopes the client needs:
   - **email:send** — submit transactional email.
   - **email:read** — inspect status for messages submitted with that same key.
   - **webhook:manage** — manage webhook subscriptions and inspect their delivery attempts.
4. Copy the key once and store it in the MCP client's server-side secret manager.
5. Configure the MCP client with:
   - URL: https://leadmaster.jelvan.pro/mcp
   - Transport: Streamable HTTP
   - Authorization: Bearer YOUR_LEADMASTER_DEVELOPER_API_KEY
6. Never place the key in browser JavaScript, a mobile bundle, public source control, prompts, or logs.

The key is account-bound. The server derives account context from the authenticated key; tool arguments cannot select another account. Revoking the developer API key immediately prevents future MCP requests using it.

## Available tools

All tools are registered only when the API key has the required scope.

| Tool | Required scope | Behavior |
|---|---|---|
| get_email_capabilities | Valid key | Reports account ID, granted scopes and available tools |
| validate_email | Valid key | Validates payload shape; does not send or save |
| send_email | email:send | Submits one message through the existing account-scoped email API and queue |
| get_email_status | email:read | Reads status only for requests created by the same API key |
| list_webhooks | webhook:manage | Lists webhooks created by the same key |
| create_webhook | webhook:manage | Creates an HTTPS callback and returns its signing secret once |
| revoke_webhook | webhook:manage | Revokes a webhook owned by the same key |
| list_webhook_deliveries | webhook:manage | Lists the latest 50 attempts for an owned webhook |

MCP does not expose the private administrator inbox, login credentials, OTP values, Cloudflare infrastructure, secret stores, database access, or other accounts' data.

## Sending workflow and confirmations

The send_email tool is a write action and is marked destructive in its MCP annotations. MCP clients should request explicit user confirmation before invoking it. The tool requires a stable idempotency_key and delegates to the same LeadMASTER developer email route used by REST, preserving:

- API-key account ownership and email:send scope checks.
- Recipient validation and suppression-list checks.
- Per-key rate limits.
- Idempotency and duplicate-request protection.
- Durable queue submission and existing send outcome states.

A successful tool response means the request was accepted by the queue, not that the recipient received or read the email. If the result is uncertain, query get_email_status with the same key before retrying. Never retry an uncertain send with a new idempotency key.

## OTP, confirmations and transactional messages

MCP and REST are transactional email delivery interfaces, not OTP identity providers. An integrating application must generate OTPs using a cryptographically secure random generator, store only a hash, enforce a short expiry and attempt limit, verify once, and invalidate after successful use. Send the code through send_email or the REST email endpoint with a unique idempotency key for that challenge. Never ask an AI agent to generate, store or verify a user's authentication OTP.

The same API supports order confirmations, account notifications, password-reset messages and other transactional notices. Keep business authorization and confirmation state in the integrating application; the email API only submits the message.

## Automation with webhooks

Use create_webhook to register a public HTTPS callback for:
- email.accepted
- email.failed
- email.unknown

The response includes signing_secret once. Store it in the callback service's secret manager. Verify HMAC-SHA256 over the exact bytes timestamp + "." + rawBody, reject stale timestamps, compare signatures in constant time, and deduplicate event IDs.

The current webhook delivery mechanism makes one attempt. Automatic retry, replay and dead-letter recovery are not implemented. A missing webhook callback does not prove an email was not submitted; query the email status endpoint.

## Security model

- Each MCP request requires an active lm_live_ API key.
- Account ID and scopes are loaded from the hashed API-key record, not trusted from MCP arguments.
- Every email status read is constrained to the same key and account.
- Every webhook read, create, revoke and delivery-history query is constrained to the same key and account.
- send_email delegates to the existing REST handler; it does not create a second sending implementation.
- MCP requests have a per-key rate limit and bounded request body.
- An Origin header, if present, must match the configured MCP_ALLOWED_ORIGIN; server-to-server clients normally omit it.
- Authorization headers, message bodies, OTPs and signing secrets must never be logged.

## Example client configuration

~~~json
{
  "mcpServers": {
    "leadmaster": {
      "url": "https://leadmaster.jelvan.pro/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_LEADMASTER_API_KEY"
      }
    }
  }
}
~~~

Configure the API key in the MCP client's secure environment; do not paste a real key into a shared configuration file.

## Testing and release gates

Before the production endpoint is advertised, run:
1. MCP initialize and tools/list using an account-bound API key.
2. Negative authentication, revoked-key, invalid-origin and request-size tests.
3. Scope matrix tests proving that missing scopes hide and reject write/read tools.
4. Cross-account and cross-key tests for email status and webhook resources.
5. Email submission tests using a controlled recipient and idempotency replay.
6. Webhook signature verification and callback tests.
7. Cloudflare production route checks and a final deployment smoke test.

The local test suite does not prove live inbox delivery or successful third-party webhook receipt. Keep claims limited to the evidence collected.
