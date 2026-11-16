# Outgoing email, queue and sending coordinator

**Status:** Immediate email submission and durable queue processing are implemented. Scheduled send and workflow-trigger execution are not implemented as production features.

## End-to-end sequence

~~~mermaid
sequenceDiagram
  participant UI as Dashboard / Account API
  participant Worker
  participant D1 as Account and mail records
  participant Q as Send queue
  participant C as Queue consumer
  participant DO as Persistent send coordinator
  participant SMTP as Email transport
  UI->>Worker: Submit recipients, subject and body
  Worker->>Worker: Authenticate, validate, check suppression and idempotency
  Worker->>D1: Persist request/batch and sending state
  Worker->>Q: Enqueue recipient work items
  Worker-->>UI: Queued / submission outcome
  Q->>C: Deliver work item
  C->>DO: Reserve rate slot and idempotency fence
  DO->>DO: Check previous outcome, quota and rolling pace
  DO->>SMTP: Submit only after durable reservation
  SMTP-->>DO: Accepted / rejected / ambiguous
  DO-->>C: Final or unknown outcome
  C->>D1: Persist status and activity
  C-->>Q: Ack / retry / dead-letter
~~~

## Important semantics

1. **Queued** means the request was stored and accepted for processing; it does not mean SMTP accepted or the recipient server delivered it.
2. **Sending** means a consumer is currently processing the work item.
3. **Accepted** means the sending transport accepted the SMTP submission.
4. **Delivered** is a separate event confirmed later through the provider event path.
5. **Unknown** means the outcome is ambiguous. The system must not blindly replay an uncertain submission.
6. Every side effect must use a stable correlation/idempotency key. A retry with a different payload under the same idempotency key is a conflict.
7. A failed or ambiguous attempt still consumes its persisted rate reservation; the queue must not move around a blocked unknown item in a way that violates ordering safety.

## Current limits and behavior

- Dashboard batch requests support up to 500 unique recipient addresses.
- Account API accepts one To recipient per request; a required 16–128 character `Idempotency-Key` is used.
- The current shared LeadMASTER coordinator is configured up to 10 send starts per second; this describes LeadMASTER paths using the coordinator, not every application in the provider account.
- The coordinator reserves rate slots before the external SMTP call and retains message outcome fences.
- Login OTP and security-alert email uses the shared coordinator but bypasses the bulk send queue.
- Immediate send only. A saved calendar reminder is not an email scheduling engine.

## Source and tests

- Request validation / account API: `src/developer-api.mjs`
- Queue validation and dispatch fence: `src/email-queue-core.mjs`
- Shared coordinator Durable Object: `src/email-coordinator.mjs`, `src/email-coordinator-client.mjs`
- SMTP transport: `src/ses-smtp.mjs`
- Queue consumer: `src/email-queue-worker.mjs`, `workers/mail-queue-consumer.js`
- Failed queue consumer: `workers/mail-failed-consumer.js`
- Operational details: `docs/QUEUE_DESIGN.md`, `docs/QUEUE_SUBMISSION_SAFETY.md`, `docs/MAIL_WORKFLOW.md`

## Recovery rules

Inspect the message/batch status before retrying. A confirmed accepted outcome is not resent. A confirmed failed outcome may be retried only according to the safe retry policy. An unknown or partially submitted batch requires reconciliation; never assume a timeout means nothing was sent.
