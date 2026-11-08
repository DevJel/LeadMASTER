# API and module reference

## Status and boundary

There is currently **no HTTP API implementation** or Worker entry point. The browser calls below are proposed integration contracts; their presence in the UI does not mean a working endpoint exists. The helper modules are not authorization boundaries and must not be exposed directly.

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

Export: `src/ses-smtp.mjs`. `connect` is the Cloudflare sockets `connect` function supplied by the caller. `env` requires `SES_SMTP_HOST`, `SES_SMTP_USERNAME`, `SES_SMTP_PASSWORD` and `SES_FROM_EMAIL`; username and password accept string secrets or Secrets Store bindings. The host must match an AWS SES SMTP endpoint, and the transport uses implicit TLS on port 465. The default network timeout is 15 seconds; it does not cover secret retrieval.

Accepts one recipient and a text-only message. It validates addresses and subject, sends base64 UTF-8 content, closes the socket, and returns `{ "status": "accepted" }` after SES accepts the DATA command. This does **not** confirm final delivery. It makes no retries. On a sending error, `deliveryOutcome` is `not_accepted` before DATA or `unknown` when DATA may have been submitted. Unknown outcomes require reconciliation before retry. Configuration and input-validation errors can occur before socket creation. Do not log secrets or message content. See [SES_TRANSPORT.md](../SES_TRANSPORT.md).

## Verification

`node --test` executes deterministic unit tests against mocked sockets and fetch. It does not verify live SES delivery, Cloudflare configuration, identity provisioning, HTTP endpoints, storage, rate limits, sessions or deployment.
