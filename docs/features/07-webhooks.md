# Account-owned webhooks

**Status:** Webhook registration, revocation, delivery history and signed delivery attempts are implemented with release limitations.

## Lifecycle

~~~mermaid
flowchart TD
  Owner[Authenticated account owner] --> Create[Create webhook]
  Create --> Key[Select active account API key]
  Key --> Scope[Require webhook:manage]
  Scope --> Validate[Validate HTTPS endpoint and event list]
  Validate --> Secret[Generate signing secret]
  Secret --> Store[Encrypt secret and store account/key ownership]
  Secret --> Reveal[Reveal secret once to owner]
  Event[Email accepted / failed / unknown] --> Select[Select active hooks for same account + key]
  Select --> Sign[HMAC timestamp + exact body]
  Sign --> Send[One synchronous HTTP attempt]
  Send --> History[Persist delivery attempt/status]
  History --> Owner
~~~

## Contract and signature

Current event names:

- `email.accepted`
- `email.failed`
- `email.unknown`

Delivery requests include the event ID and timestamp plus a versioned HMAC signature header. The signature is computed over `timestamp + "." + exact JSON body`. The receiver should verify the signature with the one-time secret, enforce a timestamp age window, compare signatures in constant time, and deduplicate event IDs.

## Ownership and safety

- Webhook belongs to a single account and creating API key.
- Dispatch filters by both `account_id` and `api_key_id`.
- Delivery history joins through the owned webhook.
- Secret is encrypted at rest and is not returned on later list requests.
- Registration requires `webhook:manage`.
- Revocation prevents future dispatch.
- HTTPS is required. Current URL screening rejects plain HTTP, userinfo, obvious IP literals and reserved local/example hostnames. It is not a complete DNS-rebinding/private-address SSRF defense; do not claim it is.

## Current delivery limitation

The current implementation performs one synchronous request attempt with a timeout and records the outcome. Do not promise a durable webhook retry queue, guaranteed delivery, or replay UI unless separately implemented and tested.

## Source

- `src/developer-webhooks.mjs`
- `src/developer-api.mjs` for API-key scope ownership
- `docs/API.md` and `docs/MCP.md` for account integration boundary
- Webhook regression tests under `test/`

## Request and callback safeguards

Registration requires a JSON object of at most 8,192 bytes and an HTTPS URL of at most 2,048 UTF-8 bytes. Local and reserved hostname suffixes, IP literals, credentials, and non-default ports are rejected, including trailing-dot forms. Existing callback URLs are rechecked before dispatch. These syntax checks do **not** validate or pin DNS answers: private-address resolution and DNS rebinding remain a release risk requiring a vetted egress solution. Invalid existing targets are recorded as unsuccessful attempts.

Developer email terminal states emit account- and API-key-scoped `email.accepted`, `email.failed`, or `email.unknown` callback attempts after the message state commits. `failed` includes suppression at dispatch; `unknown` requires reconciliation rather than blind retry. Failed and unknown events include a machine-readable `error_code`. Callback delivery is best-effort, not durable: a crash or callback error can lose the event, and pre-queue rejection may not emit an event. Consult the request status.
