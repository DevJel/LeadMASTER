# Queue pacing and SES coordination — release review

LeadMASTER routes its production administrator OTP messages, post-login security alerts and queue-driven email submissions through one SQLite-backed Durable Object identity named "ses-global". The production main Worker owns the namespace and the production queue consumer binds to that same class. Staging has a separate namespace, so test traffic cannot consume production rate slots.

## Rate guarantee inside LeadMASTER

The coordinator reserves a persistent timestamp before each external SES SMTP attempt. It spaces reservations by at least **101 ms**, which is a conservative ceiling of fewer than ten starts in any rolling one-second interval. The Durable Object serializes dispatch operations and uses strongly consistent transactional storage; the reservation is persisted before SMTP, so process restarts cannot release a fresh burst.

Each message uses a stable request UUID. An accepted or definite failure is idempotently recorded. If the SMTP outcome becomes ambiguous, that message ID is fenced and is never automatically resent; later messages can continue using later rate slots. The coordinator also maintains a conservative 50,000-submission rolling 24-hour cap unless configured otherwise in code.

This guarantee applies only to LeadMASTER paths that call the shared coordinator. It does **not** impose an AWS SES-account-wide limit on other applications, AWS credentials, services or direct SMTP clients. Any other system sharing the SES account must be routed through the same coordinator or be included in a separate AWS-account-wide rate-control design.

## Operational boundaries

- Queue sends, administrator OTPs and security alerts share the same production coordinator.
- The staging main Worker and queue consumer use their own namespace, synthetic secrets and invalid SMTP host. They cannot send live mail.
- The queue consumer has one active queue consumer and a 15-second retry delay for queue delivery failures. The coordinator itself does not retry ambiguous SMTP submissions.
- A persistent reservation can be consumed even if an isolate crashes before calling SMTP. This is intentional fail-safe behavior.
- A "sending" or "unknown" per-message state requires reconciliation; operators must not replay the same item blindly.
- An accepted SMTP response is not proof of inbox delivery. Delivery remains a separate SES event status.
- The coordinator does not prove provider quota, SES account sending limits, identity verification, DKIM/SPF/DMARC alignment, or inbox placement.

## Acceptance still required

Run concurrency and crash/restart tests against staging, verify the production and staging bindings point to their intended coordinator namespaces, inspect coordinator errors and daily volume, confirm the actual SES quota, and test delivery to an approved mailbox. The configured ten-per-second ceiling must be reconciled with the AWS SES account quota before any increase. This document does not claim control over unrelated systems using the same AWS account.
