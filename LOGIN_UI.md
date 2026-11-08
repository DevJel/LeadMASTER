# Login interface

`public/login.html` is a responsive LeadMASTER login interface. It supports the password step, a client-rendered Turnstile widget, a six-digit email-code step, loading and error states, keyboard controls, an animated cover, a landing-matched interactive halftone wordmark, a feature summary and reduced-motion preferences. The summary identifies email API, campaigns and AI/MCP as planned, not available. No simulated login or sample accounts are included.

## Production authentication integration

The production Worker gateway at `https://leadmaster.jelvan.pro` implements the same-origin authentication endpoints:

- `GET /api/auth/config`: returns the public Turnstile site key.
- `POST /api/auth/login`: verifies the login Turnstile token, administrator allowlist and password, then sends a six-digit OTP.
- `POST /api/auth/verify`: validates and consumes the OTP and issues the session.
- `GET /api/auth/session`: reports the current server-side session.
- `POST /api/auth/logout`: revokes the current session.

The production administrator allowlist is `admin@work.jelvan.pro`. The gateway challenge uses the `managed` action; the login widget uses the `login` action. Both are checked server-side against hostname `leadmaster.jelvan.pro`.

D1 stores OTP hashes, session-token hashes, expiry and attempt state. Session cookies are Secure, HttpOnly and SameSite=Strict. The challenge cookie is signed and HttpOnly. The production Worker uses Cloudflare Secrets Store bindings for the admin password, SMTP credentials and session-signing secret. The existing Turnstile secret is inherited from the previous Worker version.

The OTP and security-alert HTML templates remain canonical in `public/email-otpformat.html` and `public/email-securityalert.html`. The Worker imports a bundled copy from `src/email-templates.mjs`, so email generation does not depend on the preview site's public asset cache.

The login backend is deployed, but a real end-to-end test still requires the administrator to complete Turnstile and verify receipt of an OTP. SES sender verification and actual SMTP delivery have not been independently checked. The dashboard is a navigation shell, not a complete email workspace. Do not represent all LeadMASTER product features as production-ready.

## Branding assets

The original full logo, icon and gray favicon are organized under `public/assets/brand/`. The full logo appears on the login page in both light and dark contexts; CSS inverts it for the dark panel. The login HTML references the gray SVG favicon. The source artwork is otherwise unchanged. See [README.md](README.md) and [docs/API.md](docs/API.md) for current implementation status and contracts.
