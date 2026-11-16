# Production readiness review

This review covers a targeted inspection of the developer email and webhook paths; it is not a complete platform security audit or a production certification.

## Changes in this branch

- Stream and limit JSON request bodies for developer key creation, developer email submission, and both webhook registration routes before parsing.
- Reject additional local/reserved callback forms and revalidate saved webhook destinations before each delivery. Scope the delivery timestamp update to the webhook's account and API key.
- Exercise valid and invalid requests, streaming limits, account scoping, signature generation, and invalid stored callbacks with synthetic tests.

## Release blockers and outstanding verification

- Webhook URL syntax checks do **not** verify or pin DNS resolution. A public-looking hostname can resolve or rebind to a private or otherwise unsafe address; enforce vetted public-only egress at connection time before treating webhooks as hardened.
- Developer email idempotency currently replays an existing key without checking whether a later request has a different payload. Design and migrate a durable request fingerprint and conflict response, including safe handling of legacy rows and concurrent submissions, before claiming strict idempotency.
- Gmail-style threading, durable individual attachments, failed-send actions and inline replies remain unimplemented. See `MAIL_THREADS_DESIGN.md`; don't use this review as evidence those features are complete.
- Synthetic tests do not prove deployment, live account isolation, real delivery, real webhook callbacks, or inbox rendering against production data. Conduct controlled end-to-end tests with an authorized test account and mailbox before release.
- Root reorganization and broad ghost-button cleanup were requested only after the mail features are confirmed successful; that prerequisite has not been met.
