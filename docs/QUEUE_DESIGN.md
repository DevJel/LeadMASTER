# Email queue and rate-control design

**Status: proposed, not implemented or provisioned.** No queue consumer, coordinator, enqueue endpoint, message store or rate limiter currently exists in this repository. The following records the requested behavior and the work needed before any production sending.

## Requirement

LeadMASTER should use Cloudflare Queues and prevent its email sending from exceeding **10 messages per second globally** for the intended SES account and region. The actual configured rate must not exceed the SES account's verified sending rate; use a lower rate when the SES quota is lower. AWS also imposes a 24-hour quota. A per-Worker in-memory counter or queue concurrency setting alone cannot enforce a global limit.

## Proposed design

1. Authenticate and authorize the producer; validate the verified sender, recipient, content, permissions, limits and an idempotency key. Persist a durable message record and enqueue it using an outbox/reconciliation design that does not lose a message if storage succeeds and queue publication fails. Do not put credentials in queue payloads.
2. Use a queue message carrying only a stable message identifier. Handle queue redelivery with atomic durable state. Cloudflare Queues may deliver more than once; do not interpret a retry as permission to send again.
3. Route every LeadMASTER send for the same SES account and region through **one durable sending coordinator**, rather than one limiter per consumer. A deliberately serialized SMTP pipeline is acceptable at this small target rate. The coordinator must persist its state across restarts. As a conservative proposed policy, finish each SMTP attempt and then wait at least 101 ms before starting the next one; never pre-issue future permits to independent consumers. This limits this pipeline to fewer than ten completed sends per second under normal monotonic timing assumptions, with lower throughput if SES is slow. Review timing behavior, resets, clocks and failure cases with Cloudflare runtime tests before treating it as a guarantee.
4. Persist a sending state before the external SMTP side effect. Distinguish definitely-not-accepted, accepted and **unknown** outcomes. A crash or timeout near SMTP DATA may have sent the email: preserve it as unknown and require reconciliation instead of blindly retrying. Do not promise exactly-once delivery over SMTP.
5. Acknowledge queue messages only once the durable state is safely recorded. Known safe pre-submission failures may be retried with bounded backoff; permanent rejections require operator-visible handling. Set a dead-letter queue and alert on backlog, unknown outcomes, rejected messages, rate-limit events and retry exhaustion. Do not log message bodies, recipient addresses or credentials.
6. Validate quotas, sending identity, sender permissions, reputation and bounce/complaint processing before live use. Send test messages only to approved recipients in an isolated environment.

This coordinator controls only sends routed through it. Other applications using the same SES account/region can consume the same quota and invalidate an account-wide guarantee; inventory them and coordinate or reserve capacity. SES throttling, network timing, platform limits, queue retention, crashes and deployment behavior require integration and load testing.

## Validation and release gates

- Concurrency: submit concurrent and duplicated identifiers across queue consumers; verify no duplicate SMTP attempt for a recorded completed message and no more than the approved rate for every rolling one-second interval in controlled tests.
- Failure injection: queue redelivery, storage failure, coordinator restart, clock changes, timeout before and after DATA, SES 4xx/5xx, quota exhaustion and dead-letter handling. Confirm uncertain sends are not automatically repeated.
- Reconciliation: exercise outbox replay and unknown-outcome review without losing or silently duplicating messages.
- Operations: record effective SES per-second and daily quotas, sender identity, deployment environment, metrics, alert owner, runbook and rollback. Test with a real SES account and authorized recipient before release.

References: [Cloudflare queue configuration](https://developers.cloudflare.com/workers/wrangler/configuration/), [Durable Objects storage](https://developers.cloudflare.com/durable-objects/best-practices/access-durable-objects-storage/), [SES quotas](https://docs.aws.amazon.com/ses/latest/dg/manage-sending-quotas.html), [SES quota errors](https://docs.aws.amazon.com/ses/latest/dg/manage-sending-quotas-errors.html).
