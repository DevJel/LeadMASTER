# LeadMASTER SMTP integration status

## Current production transport

The deployed LeadMASTER Worker uses the shared EmailCoordinator Durable Object and AWS SES SMTP for transactional mail. The production Wrangler configuration maps the following Secret Store entries to runtime bindings:

| Runtime binding | Secret Store entry |
|---|---|
| SES_SMTP_HOST | AWS_SES_SMTP_HOSTNAME |
| SES_SMTP_USERNAME | AWS_SES_SMTP_USERNAME |
| SES_SMTP_PASSWORD | AWS_SES_SMTP_PASSWORD |

The configured sender is noreply@leadmaster.jelvan.pro. The main Worker also has the MAIL_SEND_QUEUE producer and EMAIL_COORDINATOR Durable Object binding. The daily reporter's transport health check verifies that the SES host, username, password and sender configuration are present. It does not perform a test send or prove inbox delivery.

## External SMTP settings

The account-scoped external SMTP database migrations (0016, 0017 and 0018) are present in the production Turso schema. The external_smtp_connections table currently has no connection records, and external_smtp_activity has no recorded submissions.

The external SMTP UI, settings route, verification coordinator, credential store and sender-selection helpers are staged modules. They are not mounted into the production Worker or dashboard. No external SMTP credential-encryption key binding is configured. The current mail queue and EmailCoordinator send path use SES; no verified external sender is selected for outgoing messages.

Therefore, do not show an external SMTP connection as active, do not allow it to be selected for sending, and do not claim external SMTP delivery is enabled.

## Release requirements before enabling custom SMTP

1. Provision a dedicated random 256-bit credential-encryption key in Cloudflare Secrets Store and implement tested key-version rotation and recovery.
2. Implement a safe outbound socket factory. Validate DNS A/AAAA answers, reject private/reserved destinations, validate the actual connected remote address against the checked DNS set, enforce ports 465/587 only, and require TLS certificate verification.
3. Await the asynchronous safe-socket factory in the SMTP probe and run real Cloudflare edge tests; local mocks alone do not prove the runtime network boundary.
4. Mount the settings API only behind the authenticated administrator session and same-origin mutation checks.
5. Connect the settings panel to the production dashboard and expose only verified, account-owned senders.
6. Pin the selected connection ID and revision into each queued job. Recheck ownership, revision, verification state and revocation immediately before dispatch.
7. Route external SMTP through the shared durable coordinator; do not place usernames, passwords or encrypted envelopes in queue payloads or logs.
8. Record queued, accepted, failed and unknown outcomes with account/connection ownership and idempotency. Never retry an uncertain SMTP submission automatically.
9. Add cross-account, SSRF, DNS-rebinding, TLS, credential-rotation, queue-redelivery, revocation-race, and failure-injection tests.
10. Verify controlled test-recipient submission and inspect actual provider acceptance before enabling the setting in production.

The existing SES transport remains the only active production sender until every gate above is complete.
