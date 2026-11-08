# LeadMASTER API and module reference

## Production status

The production Worker is hosted at `https://leadmaster.jelvan.pro`. Its currently supported HTTP API is the same-origin, single-administrator authentication flow documented below.

**There is no supported public email-submission API in production.** The repository's experimental `POST /api/v1/emails` route is disabled by default and is not part of the deployed production Worker. Do not integrate against it or treat the prototype's response format as a production contract.

The dashboard remains a navigation shell. Campaigns, audiences, general email sending, template persistence, delivery status and public API-key management are not production-ready.

## Authentication endpoints — deployed

All endpoints are same-origin. State-changing requests use JSON and are protected by same-origin checks and rate limits. The current deployment supports one configured administrator.

### `GET /api/auth/config`

Returns the public Turnstile site key for the login page. The secret key is never returned.

### `POST /api/auth/login`

Starts administrator sign-in.

Request:
```json
{"identity":"admin@example.com","password":"<administrator password>","turnstileToken":"<single-use Turnstile token>"}
```

The server verifies the Turnstile token for the configured hostname and `login` action, checks the administrator allowlist and password, and applies D1-backed rate limits. It then creates a single-use six-digit email challenge and sends it through AWS SES SMTP.

Success:
```json
{"next":"verify_email"}
```

The OTP expires after 10 minutes and allows at most five attempts. Generic errors are returned for invalid credentials. A rate-limited request returns HTTP 429.

### `POST /api/auth/verify`

Completes the email challenge.

Request:
```json
{"code":"123456"}
```

Success:
```json
{"authenticated":true}
```

The response sets an eight-hour Secure, HttpOnly, SameSite=Strict session cookie. The code is consumed once. D1 stores challenge and session hashes, expiries and attempt counts rather than plaintext OTP or session tokens.

### `GET /api/auth/session`

Returns whether the current browser session is authenticated and the associated configured administrator email. The session cookie is HttpOnly and must not be copied into application storage.

### `POST /api/auth/logout`

Revokes the current D1-backed session and expires the session cookie. The request must be same-origin.

These are browser authentication endpoints, not general-purpose API credentials, OAuth, or a multi-user identity API. Do not use them as an email-send authorization mechanism.

## Public email submission — unavailable

The experimental `POST /api/v1/emails` implementation is disabled by default and not deployed in the production Worker. No production API key issuance, key rotation, delivery-status endpoint or public send contract exists.

The repository prototype describes a bearer-key request with an idempotency key and a 100 KB payload limit, but this is not a live production interface. It must remain disabled until scoped credentials and lifecycle, authorization, consent/suppression, abuse limits, durable queue acceptance, idempotency, monitoring, delivery events, reconciliation and operator recovery are implemented and reviewed.

Never put API keys in browser code, URLs, source control or logs. A queued acknowledgement, if a future API provides one, must not be described as final delivery.

## Email transport

The deployed authentication gateway uses AWS SES SMTP for sign-in OTP and best-effort security-alert email. The transport uses implicit TLS on port 465. SMTP host, username and password and sender configuration are supplied through Cloudflare Secrets Store bindings.

SES accepting an SMTP DATA command is not proof of final inbox delivery. Sender identity, account sending mode, quotas and live deliverability must be verified independently. General customer email sending is not available through the production gateway.

## Internal modules

The repository also contains internal helpers for Turnstile verification, SES SMTP, queue input validation, enqueueing, queue consumption and MCP validation. These modules are not public authorization boundaries and must not be exposed directly. The queue producer/consumer and recovery design remain experimental; see [QUEUE_DESIGN.md](./QUEUE_DESIGN.md).

## Verification

Local `npm test` checks use mocked external boundaries. They do not verify live SES delivery, production API availability, queue deployment, real recipient consent, or end-to-end production behavior.
