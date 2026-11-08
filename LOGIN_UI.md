# Login interface

`public/login.html` is a responsive LeadMASTER login interface. It supports the password step, a server-rendered Turnstile widget, a six-digit email-code step, loading and error states, keyboard controls, an animated cover and reduced-motion preferences. No simulated login or sample accounts are included.

## Integration boundary — not yet implemented

The UI is not a working authentication system and must not be deployed as one. It fails closed when its configuration endpoint is absent. The following proposed same-origin endpoints require a security-reviewed server implementation:

- `GET /api/auth/config`: return the public Turnstile site key as `turnstileSiteKey`.
- `POST /api/auth/login`: validate username or email against the provisioned allowlist, password, server-side Turnstile, abuse controls and issue a single-use, time-limited email verification challenge. Return `{ "next": "verify_email" }` only after success. Authentication secrets must remain server-side.
- `POST /api/auth/verify`: verify the challenge atomically, enforce expiry and attempt limits, create a secure session, and return `{ "authenticated": true }` only after successful verification.

The backend must enforce origin/CSRF protection, secure HttpOnly SameSite cookies, rate limiting across instances, replay prevention, fail-closed secret/config handling, authorization on every private endpoint, session revocation, generic public errors and redacted logging. SMTP acceptance does not mean the code was delivered. Protect against ambiguous send outcomes. Neither the UI nor the Turnstile component alone is an authentication boundary.

The requested 100 individually named username/email pairs cannot all be supplied as ordinary variables to a single Worker under published per-Worker variable limits; an approved secrets arrangement is still needed. No production secrets, Turnstile keys, sender, Worker, route, storage, or account configuration is supplied here.
