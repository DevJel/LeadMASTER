# Production authentication and release notes

> **Public documentation hub:** [LeadMASTER documentation](https://leadmaster.jelvan.pro/#documentation). This file is the engineering reference for the current production Worker and Android release gates.

## Verified production deployment

- Production application hostname: `https://leadmaster.jelvan.pro`
- Worker: `leadmaster` in the Lead Master Web App Cloudflare account.
- Worker entry point: `worker.js`; public UI source: `public/`; generated static asset bundle: `src/static-assets.mjs`.
- Primary database: Turso/libSQL, region URL `libsql://leadmaster-devjel.aws-ap-southeast-2.turso.io`.
- `TURSO_URL` is a plain-text endpoint; `TURSO_AUTH_TOKEN` is a Secrets Store binding. The Worker exposes a D1-compatible statement facade as `AUTH_DB`; this is not a Cloudflare D1 binding.
- Primary sender: `noreply@leadmaster.jelvan.pro`; SES SMTP over STARTTLS.
- Turnstile action: `login`; the public site key is a Worker variable and the Siteverify secret remains in Secrets Store.
- `EmailCoordinator` is an existing SQLite-backed Durable Object. Its production namespace is `leadmaster_EmailCoordinator`; the Worker settings must retain the named `EmailCoordinator` export with SQLite storage.
- The production observability settings have query-string redaction enabled. Invocation logs remain enabled and persisted; traces remain disabled.

## Actual sign-in flow

1. `GET /api/auth/config` returns the public `TURNSTILE_SITE_KEY` Worker variable.
2. The login browser widget requests a Turnstile token with action `login`.
3. `POST /api/auth/login` enforces same-origin, shared IP and administrator-identity rate limits (hashed bucket identifiers), server-side Turnstile Siteverify, expected hostname and action, administrator allowlist, and configured password verification.
4. A successful password check generates a six-digit OTP, stores an HMAC hash in Turso and sends the code through the shared SES email coordinator. The OTP expires after 10 minutes.
5. `POST /api/auth/verify` enforces an IP rate limit in addition to the challenge's five-incorrect-attempt limit, validates expiry and single use, consumes the code and creates a 32-byte random opaque session token.
6. Only the SHA-256 hash of the session token is stored in Turso. The cookie is Secure, HttpOnly, SameSite=Strict and persists for 180 days. The server-side session and cookie use the same expiry; closing the Android app does not revoke or clear it. Successful session restores renew the rolling expiry. Explicit sign-out revokes the session and clears the cookie.
7. `GET /api/auth/session` checks the server-side session. `POST /api/auth/logout` revokes it.

There is no JWT session implementation. The `SESSION_SECRET` binding is used for OTP HMAC and webhook-secret encryption; do not rotate it without a migration plan for encrypted webhook secrets.

PBKDF2 password hashes are supported, but the legacy secret-value password format remains accepted pending a controlled credential migration. The legacy password format must be replaced with a PBKDF2 hash before declaring password storage fully hardened. Passkeys/WebAuthn are not yet implemented and must not be advertised as available.

## Runtime bindings

- `ADMIN_EMAIL`, `ADMIN_PASSWORD`: Secrets Store credentials.
- `SESSION_SECRET`: Secrets Store binding used for OTP HMAC and webhook-secret encryption.
- `TURNSTILE_SITE_KEY`: public Worker variable; `TURNSTILE_SECRET`: Secrets Store binding.
- `SES_SMTP_HOST`, `SES_SMTP_USERNAME`, `SES_SMTP_PASSWORD`: SES SMTP credentials from Secrets Store.
- `SES_FROM_EMAIL`: configured sender identity.
- `TURSO_URL`: Turso endpoint; `TURSO_AUTH_TOKEN`: Secrets Store token.
- `EMAIL_COORDINATOR`: existing SQLite-backed `EmailCoordinator` Durable Object namespace.
- Other production bindings include Workers AI, R2 inbound-mail storage, send Queue, Auto-Heal KV, and GitHub/Cloudflare Secrets Store credentials.

Never put secret values in GitHub source, generated static assets, public docs or logs. Never log OTPs, passwords, session tokens, SMTP credentials or authorization headers.

## Android app and release gates

- Package: `pro.leadmaster.app`; current app version in source: 1.9.1 / versionCode 11.
- The app is a WebView shell. The native bridge uses AndroidX WebKit message listeners, exact HTTPS origin rules, main-frame checks and a strict message allowlist. Unsupported WebView providers omit optional bridge features.
- The debug APK is not a production release. The last verified CI build produced a debug APK; production signing was skipped because the workflow did not detect all four Android signing secrets.
- Passkey registration, assertion verification, Android Credential Manager integration and Digital Asset Links association are not implemented. Do not expose passkey UI or enable passkey login until a vetted WebAuthn server implementation and native Credential Manager flow are tested end-to-end.
- A production signing certificate fingerprint is required to publish and verify Digital Asset Links for the installed app. Do not substitute a debug certificate or accept arbitrary origins.
- Device-level acceptance is still required for login, OTP, app restart/session restore, logout, Turnstile, network interruption and WebView bridge behavior.

## Email templates

Canonical templates:
- `public/email-otpformat.html`
- `public/email-securityalert.html`

The Worker imports `src/email-templates.mjs`, a generated module copy. After editing either canonical template, regenerate the module copy and test it before deployment. Replacement values must remain HTML-escaped.

## Verification boundary

Automated tests use mocks and do not establish live Cloudflare, Turnstile, SES inbox delivery or end-user behavior. SMTP coordinator health confirms configuration and reachability; it does not guarantee inbox placement. Complete a controlled browser sign-in, OTP receipt, session restore and logout test, plus an approved test email, before declaring operational acceptance.

Run `npm ci --ignore-scripts`, `npm test`, `npm run build:assets`, `npm run build:workers` and `npm run check:dashboard`. The repository's full CI must be green before release; known missing-source/build failures must be fixed, not skipped or hidden.

## Security hardening status

- Login requests are throttled using shared Turso counters for IP and the configured administrator identity. Bucket identifiers are SHA-256 hashes; raw IP addresses and email addresses are not stored in rate-limit keys.
- OTP verification has an IP throttle in addition to the per-challenge five-attempt limit and ten-minute expiry.
- Rate-limit storage fails closed: if the shared limiter cannot be read or updated, authentication is temporarily unavailable rather than proceeding without abuse controls.
- Login audit-event persistence is best-effort and no longer blocks OTP delivery when the audit table is temporarily unavailable.
- Cloudflare Worker query-string redaction is enabled. This does not replace application-level redaction: secrets and personal data must still never be written to log messages.
- The Android native bridge uses AndroidX WebKit message listeners, exact HTTPS origin rules, main-frame checks and a strict message allowlist.
- Passkeys, production Android signing, Digital Asset Links, full repository CI and real-device acceptance remain release blockers until independently verified.
