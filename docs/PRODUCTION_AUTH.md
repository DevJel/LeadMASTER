# Production authentication and release notes

> **Public documentation hub:** [LeadMASTER landing page → Documentation](https://leadmaster.jelvan.pro/#documentation). This file is the repository's detailed engineering reference; the public product guide is maintained in the landing page, not on a separate public documentation site.


## Deployment and source of truth

- Production hostname: `https://leadmaster.jelvan.pro`
- Cloudflare Worker: `leadmaster`
- Worker entry point: `worker.js`
- Public UI source: `public/`
- Production static asset bundle: `src/static-assets.mjs` (generated from canonical public files)
- D1 database: `leadmaster-auth`, binding `AUTH_DB`
- Turnstile hostname: `leadmaster.jelvan.pro`
- Login Turnstile action: `login`
- SES transport: SMTP with STARTTLS, port 587

## Actual sign-in flow

1. `GET /api/auth/config` returns the public `TURNSTILE_SITE_KEY` Worker variable.
2. The login browser widget requests a Turnstile token with action `login`.
3. `POST /api/auth/login` enforces same-origin, IP/email rate limits, server-side Turnstile Siteverify, expected hostname and action, administrator allowlist, and configured password verification.
4. A successful password check generates a six-digit OTP, stores an HMAC hash in D1 and sends the code through SES SMTP. The OTP expires after 10 minutes.
5. The OTP is submitted through the shared SQLite-backed `EmailCoordinator` Durable Object, which reserves a persistent 101 ms send slot shared with queue mail and login security alerts. An ambiguous SMTP outcome preserves the OTP challenge so a code that was actually delivered can still be verified; no automatic duplicate send is attempted.
6. `POST /api/auth/verify` validates the code, enforces expiry, single use and a maximum of five incorrect attempts (without an IP-based verification throttle for the primary administrator), consumes it and creates a 32-byte random opaque session token.
7. Only the SHA-256 hash of the session token is stored in D1. The cookie is Secure, HttpOnly, SameSite=Strict and expires after eight hours.
8. `GET /api/auth/session` checks the server-side session. `POST /api/auth/logout` revokes it.

There is no JWT session implementation. The `SESSION_SECRET` Worker binding currently points to the legacy Secrets Store entry `ADMIN_JWT_TOKEN`; this is a naming mismatch only, not evidence of JWT usage. It is used for OTP HMAC and webhook-secret encryption. Do not rotate it without a migration plan for encrypted webhook secrets.

The current login flow uses the `login` Turnstile action. The source contains an unused challenge-cookie validation helper; it is not an additional active gateway challenge. PBKDF2 password hashes are supported, but the legacy secret-value password format remains accepted pending a controlled credential migration.

## Bindings

- `AUTH_DB`: D1 database `leadmaster-auth`.
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`: Secrets Store credentials.
- `SESSION_SECRET`: binding to the existing `ADMIN_JWT_TOKEN` Secrets Store entry.
- `TURNSTILE_SITE_KEY`: public Worker variable containing the LeadMASTER production widget site key.
- `TURNSTILE_SECRET`: Secrets Store binding to `TURNSTILE_SECRET_KEY`.
- `SES_SMTP_HOST`, `SES_SMTP_USERNAME`, `SES_SMTP_PASSWORD`: SES SMTP credentials from Secrets Store. They are bound to the main Worker that hosts the coordinator; the queue consumer has no direct SMTP credential bindings.
- `EMAIL_COORDINATOR`: one SQLite-backed Durable Object namespace named `ses-global`, exported by the main Worker and bound to the queue consumer.
- `SES_MAX_MESSAGES_PER_SECOND`: configured to `10`; the coordinator reserves slots at a minimum 101 ms interval.
- `SES_FROM_EMAIL`: configured sender identity.

Never put secret values in GitHub, generated static assets, public docs or logs. The site key is public; the Siteverify secret is not.

## Email templates

Canonical templates:
- `public/email-otpformat.html`
- `public/email-securityalert.html`

The Worker imports `src/email-templates.mjs`, a generated module copy. After editing either canonical template, regenerate the module copy and test it before deployment. Replacement values must remain HTML-escaped.

## Production status and test boundary

The Worker auth endpoints and bindings are deployed. Source and route checks are not a substitute for a real browser login. Still required for full acceptance: complete Turnstile in a browser, verify the password, receive the OTP, complete login, confirm session persistence, and log out. Separately verify SES delivery to an approved test mailbox. Do not describe SMTP acceptance as inbox delivery.

Run `npm ci --ignore-scripts` and `npm test`. Tests use mocks and do not establish live Cloudflare, Turnstile, SES or inbox behavior.


## Shared send coordinator

Administrator OTPs, post-login security alerts and queue-driven mail all call the internal `EMAIL_COORDINATOR` binding. The coordinator is hosted by the main Worker; the queue consumer uses a cross-Worker binding to the same class. Staging owns an isolated namespace and never shares production rate state. The coordinator persists rate reservations and per-message outcome fences before external SMTP work. Do not add a direct SMTP fallback to any LeadMASTER send path. This limit applies to LeadMASTER only, not every client using the AWS SES account.
