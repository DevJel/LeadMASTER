# API and module reference

## Status and boundary

An experimental `POST /api/v1/emails` submission route exists in code, **disabled by default and not deployed**. It is not production-ready. A Queue consumer Worker entry point exists but is not configured or deployed. The browser calls below are proposed integration contracts; their presence in the UI does not mean a working endpoint exists. The helper modules are not authorization boundaries and must not be exposed directly.

## Experimental email submission — disabled and not deployed

`POST /api/v1/emails` accepts one text-only message only when the `EMAIL_API_ENABLED` configuration equals `true`, the `EMAIL_QUEUE` producer is bound, and `EMAIL_API_KEY` is available as a Worker secret or Secrets Store binding. Keep the flag disabled until all release gates below are met. The key must be a cryptographically random 43–128 character base64url string; do not put it in browser code or source control. This is a **single shared key**, not a key-management service or admin login.

Request: `Authorization: Bearer <key>`, `Content-Type: application/json`, and `Idempotency-Key: <16–128 ASCII letters, digits, hyphens or underscores>`. The body contains only `to`, `subject`, and `text`. The configured SES identity supplies the sender. Requests are limited to 100,000 bytes. A `202` response `{ "id": "<idempotency key>", "status": "queued" }` means the Queue accepted the job; it does not mean SES accepted or delivered it. No internal send-rate information is returned. Failures use generic 400, 401, 405, 413, 415 or 503 responses.

The client must reuse the same idempotency key **only with identical message content** when retrying an uncertain submission. Duplicate queue messages are deduplicated by the existing coordinator. Reusing a key with changed content is detected only during consumption; this prototype has no public status endpoint and does not synchronously report that conflict. There is no key issuance, rotation interface, authentication UI, consent policy, endpoint abuse limit, live delivery-status endpoint or recovery interface. Queue retries, failed and unknown SMTP outcomes still require operator handling. Never interpret `queued` as `delivered`.

**Release gates:** independent security review, scoped credentials and key lifecycle, request abuse controls, queue and DLQ bindings, retention and privacy controls, monitored recovery for unknown outcomes and queue publication/consumption, integration tests in an isolated Cloudflare environment, verified SES identity and quota, and an authorized live-recipient test. The API must remain disabled until these are completed; the local tests only use mocks.

## Proposed authentication HTTP endpoints

All requests are same-origin; the browser uses same-origin credentials, `Cache-Control: no-store` request behavior and JSON for POST bodies. Production code must validate origin/CSRF, authenticate and authorize protected endpoints, use secure HttpOnly SameSite session cookies, rate-limit durably, avoid account enumeration, and prevent replay.

### `GET /api/auth/config` — not implemented

Purpose: supply the public Turnstile site key to the login UI.

- Success: JSON object containing a nonempty `turnstileSiteKey` string.
- Failure: non-2xx or unreachable configuration prevents login and displays a generic availability message. Secret keys must never be returned.

### `POST /api/auth/login` — not implemented

Purpose: start sign-in for a configured admin after password and Turnstile verification.

- JSON request: `{ "identity": "<username or email>", "password": "<password>", "turnstileToken": "<single-use token>" }`.
- Proposed success: `{ "next": "verify_email" }`, after the server has validated the allowlist, password and Turnstile and has securely issued an email challenge. The response must not include credentials or the code.
- Client behavior: `429` displays a rate-limit message; other non-2xx responses show a generic sign-in failure. Network errors and unexpected success bodies show a generic availability error. The client clears the password and resets Turnstile after the attempt.
- Required server safeguards: configured admin identities only, secure password hashing, replay prevention, server-side Turnstile validation with the expected hostname and action, rate limits and generic errors. Challenge state, delivery handling and cookies require a reviewed implementation.

### `POST /api/auth/verify` — not implemented

Purpose: complete the email verification challenge and establish a session.

- JSON request: `{ "code": "<six digits>" }`; the UI expects challenge context to be maintained securely server-side.
- Proposed success: `{ "authenticated": true }`, followed by navigation to `/`. The destination is not implemented.
- Client behavior: `429` displays a rate-limit message; other non-2xx responses show a generic verification error. The UI permits returning to sign-in.
- Required server safeguards: an atomic single-use challenge, expiry, attempt limits, session issuance/rotation/revocation, appropriate cookie attributes and server-side authorization. These controls are not present yet.

## Implemented internal modules

### `verifyTurnstile({ token, secret, expectedHostname, expectedAction, fetcher?, timeoutMs? })`

Export: `src/turnstile.mjs`. Returns `true` only for a successful Siteverify response matching both hostname and action; otherwise returns `false`. `secret` may be a string or a Secrets Store binding with `get()`. `fetcher` defaults to `fetch`; the default network timeout is 5 seconds. The helper rejects empty or oversized tokens and invalid configuration, and fails closed on verification failures. The timeout applies to the network request, not secret retrieval. The helper does not authenticate a user or implement a route.

### `sendSesEmail({ connect, env, to, subject, text, timeoutMs? })`

Export: `src/ses-smtp.mjs`. `connect` is the Cloudflare sockets `connect` function supplied by the caller. `env` requires `SES_SMTP_HOST`, `SES_SMTP_USERNAME`, `SES_SMTP_PASSWORD` and `SES_FROM_EMAIL`; the host, username and password accept strings or Secrets Store bindings. The host must match an AWS SES SMTP endpoint, and the transport uses implicit TLS on port 465. The default network timeout is 15 seconds; it does not cover secret retrieval.

Accepts one recipient and a text-only message. It validates addresses and subject, sends base64 UTF-8 content, closes the socket, and returns `{ "status": "accepted" }` after SES accepts the DATA command. This does **not** confirm final delivery. It makes no retries. On a sending error, `deliveryOutcome` is `not_accepted` before DATA or `unknown` when DATA may have been submitted. Unknown outcomes require reconciliation before retry. Configuration and input-validation errors can occur before socket creation. Do not log secrets or message content. See [SES_TRANSPORT.md](../SES_TRANSPORT.md).

## Verification

`node --test` executes deterministic unit tests against mocked sockets and fetch. It does not verify live SES delivery, Cloudflare configuration, identity provisioning, HTTP endpoints, actual Durable Object storage, production rate limits, sessions or deployment.


### `enqueueEmail(queue, job)`

Export: `src/email-queue-core.mjs`. A trusted, authenticated and authorized server caller may submit `{id, to, subject, text}` to a Cloudflare Queue binding. It validates inputs and a 100,000-byte serialized payload limit, and returns `{ "status": "queued" }` after the Queue accepts the message. This is not proof of SMTP acceptance or final delivery. The function does not implement authentication, authorization, consent, an outbox, idempotent producer storage, or an HTTP endpoint. See [QUEUE_DESIGN.md](QUEUE_DESIGN.md).

### Queue consumer and coordinator

`src/email-queue-worker.mjs` provides a Queue consumer and internal Durable Object handler. `SES_MAX_MESSAGES_PER_SECOND` must be explicitly set to a verified integer from 1 through 10. `SES_MAX_MESSAGES_PER_DAY` must also be explicitly configured from 1 through 50,000. A single Durable Object serializes all sends, conservatively reserves attempts in rolling daily minute buckets and waits at least 101 ms after completion at the maximum per-second setting. The daily counter only covers sends made through this coordinator, not other applications sharing the SES account and region. Terminal states are acknowledged; blocked or unavailable work is delayed for retry. Cloudflare retry counts and message retention are finite, and unknown outcomes lack a recoverable payload; durable recovery and dead-letter monitoring remain release blockers. An uncertain SMTP outcome blocks further sends until an authorized recovery mechanism is implemented. This code has not been tested on Cloudflare or integrated with a real producer. It is not a public HTTP API. See [QUEUE_DESIGN.md](QUEUE_DESIGN.md).

## Public Worker routing (implemented, not deployed)

The Worker HTTP adapter in `src/http-router.mjs` serves static requests through its `ASSETS` binding; non-GET/HEAD static requests receive 405. API paths never fall through to static assets. `GET /api/auth/config` returns a no-store 503 generic availability response until a real authentication service is implemented, so the existing login UI stays disabled. The experimental `/api/v1/emails` route fails closed unless explicitly enabled and configured; other `/api` paths return a no-store 404. POST to the config endpoint returns 405. The adapter is exported by the same entry point as the queue consumer. This does not implement sign-in or sessions. The email-submission route is experimental and disabled by default.
