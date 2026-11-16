# Account-scoped Developer Email API and API keys

**Status:** Account-scoped API key management and email request/status routes are implemented in source. Controlled authenticated end-to-end acceptance remains a release check.

## Key lifecycle and request flow

~~~mermaid
sequenceDiagram
  participant Owner as Authenticated account owner
  participant Console as LeadMASTER console
  participant D1 as Account database
  participant Agent as Owner's server / integration
  participant API as Account-scoped API
  participant Queue as Email queue
  Owner->>Console: Create API key with minimum scopes
  Console->>D1: Store key hash, prefix, account and scopes
  Console-->>Owner: Reveal plaintext key once with account endpoint
  Owner->>Agent: Store key in server-side secret manager
  Agent->>API: Bearer key + account ID + idempotency key
  API->>D1: Verify key, scope and account ownership
  API->>D1: Check prior idempotency record and suppression
  API->>Queue: Enqueue authorized request
  Queue-->>API: Submission outcome
  API-->>Agent: Request ID and current status
  Agent->>API: GET status with email:read scope
~~~

## Supported scopes

- `email:send`: submit an account-owned email request.
- `email:read`: read status for requests created under that account/key.
- `webhook:manage`: create, list, revoke and inspect owned webhook registrations/deliveries.

Keys are shown once, hashed at rest and tied to an account. Revoke is account-constrained. An account ID is an identifier, not a secret or proof of authorization.

## Endpoint contract

Use the exact account ID and API base URL supplied by the authenticated account console or key creation response.

- `GET /api/v1/accounts/{account_id}`
- `POST /api/v1/accounts/{account_id}/emails`
- `GET /api/v1/accounts/{account_id}/emails/{request_id}`
- `POST /api/v1/accounts/{account_id}/webhooks`
- `GET /api/v1/accounts/{account_id}/webhooks`
- `DELETE /api/v1/accounts/{account_id}/webhooks/{webhook_id}`
- `GET /api/v1/accounts/{account_id}/webhooks/{webhook_id}/deliveries`

Every route validates the Bearer key, scope, route account ID and resource ownership. An ID alone is not authorization. Legacy unscoped email/webhook APIs are rejected.

## Email request safeguards

- A valid account-bound key with `email:send` is mandatory.
- `Idempotency-Key` must be 16–128 permitted characters; the same key must represent the same logical payload.
- Recipient, sender, subject and body are validated.
- Suppressed recipients are not sent.
- Per-key request limits apply.
- API acceptance returns a request ID but does not prove delivery; query status and distinguish sending state from delivery state.

## Source and tests

- `src/developer-api.mjs`
- Worker route integration: `worker.js`
- Migrations for account/key/email request ownership: review `migrations/` and the migration ledger
- API reference: `docs/API.md`
- Cross-account tests: `test/account-isolation.test.mjs` and developer API regression tests

## Security boundary

Never store API keys in browser JavaScript, screenshots, mobile application assets, public documentation examples, logs or source control. Agents authenticate to the REST API with a server-side key, not by driving the human login screen.
