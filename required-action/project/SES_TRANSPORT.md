# SES SMTP transport

This module is the SMTP transport used by the deployed LeadMASTER authentication Worker for OTP and best-effort security-alert emails. The separate campaign/email-submission Queue system remains experimental, disabled by default and not production-ready.

- `src/ses-smtp.mjs` exports `sendSesEmail`. Supply `connect` from `cloudflare:sockets` within a Worker handler, not global scope.
- The public SES SMTP endpoint format is `email-smtp.<region>.amazonaws.com`; for Sydney it is `email-smtp.ap-southeast-2.amazonaws.com`. The deployed Worker uses implicit TLS on port `465`. Its `SES_SMTP_HOST`, `SES_SMTP_USERNAME`, `SES_SMTP_PASSWORD`, `ADMIN_PASSWORD`, `SESSION_SECRET` and `SES_FROM_EMAIL` bindings resolve from the Cloudflare Secrets Store. `SES_FROM_EMAIL` currently maps to the existing `ADMIN_EMAIL` secret. That sender must be verified in the same SES region. No AWS account or credentials were accessed for this implementation, and live SES delivery/sender verification has not been confirmed. See [AWS SES endpoints](https://docs.aws.amazon.com/general/latest/gr/ses.html).
- The module uses implicit TLS on port 465, authenticates only after TLS, limits the input to one recipient and a message with plain text and optional HTML, and sends no automatic retries. The authentication Worker enforces the admin allowlist, OTP/session controls and rate limits before calling the transport. Other callers must independently enforce authorization, sender policy, throttling and durable per-message state.
- An `accepted` response means SES accepted the message for processing, not that the recipient received it. An `unknown` error means SES may have accepted it: reconcile before any retry to avoid duplicates. `not_accepted` indicates rejection or failure before the DATA phase.
- Run local deterministic tests with `node --test`. These tests use mock sockets; they do not prove Cloudflare runtime compatibility, SES delivery, sender verification, or production readiness.


## Deployed authentication usage

The production gateway sends the branded OTP template on password success and sends the branded security alert after OTP verification. See [Production authentication](docs/PRODUCTION_AUTH.md) for the placeholder map and release status. Security-alert delivery is best-effort after session creation; OTP delivery is required to complete sign-in.
