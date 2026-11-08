# SES SMTP transport

This is an isolated transport module, not an application or a deployed service. No HTTP route calls it. Production use requires authenticated, authorized application endpoints, sender verification, an approved Cloudflare account, durable send-state/idempotency, rate limits, observability, security review and a real SES integration test.

- `src/ses-smtp.mjs` exports `sendSesEmail`. Supply `connect` from `cloudflare:sockets` within a Worker handler, not global scope.
- Configure `SES_SMTP_HOST` as the SES SMTP hostname for the verified identity's region, and `SES_FROM_EMAIL` as the verified sender. Store `SES_SMTP_USERNAME` and `SES_SMTP_PASSWORD` in Worker secrets or Secrets Store bindings. Do not commit them.
- The module uses implicit TLS on port 465, authenticates only after TLS, limits the input to one text-only recipient and message, and sends no automatic retries. The caller must enforce authorization, sender policy, throttling and durable per-message state.
- An `accepted` response means SES accepted the message for processing, not that the recipient received it. An `unknown` error means SES may have accepted it: reconcile before any retry to avoid duplicates. `not_accepted` indicates rejection or failure before the DATA phase.
- Run local deterministic tests with `node --test`. These tests use mock sockets; they do not prove Cloudflare runtime compatibility, SES delivery, sender verification, or production readiness.
