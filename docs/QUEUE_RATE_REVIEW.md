# Queue pacing and delivery status — release notes

The requested cap is ten email submissions per second across the SES account. The previous queue consumer slept 100ms between messages within one batch but skipped the pause after the last item, permitting adjacent submissions at a batch boundary. This branch adds the final pause and tests two consecutive batches. The configured queue consumer concurrency is one; actual Cloudflare behavior must be tested.

This change is a mitigation, not proof of a strict global limit: crashes or retries may cross batch boundaries, concurrency can change, and login OTP and security alerts call SMTP directly, outside the queue. Other applications may use the same SES account. A robust coordinated account-wide rate limiter with reserved capacity for authentication, provider-quota verification and failure/recovery tests is still required. Do not break the existing login flow or silently hide actual failed or unknown results.

The consumer also requires migrations 0009 and 0010. Do not deploy it until a staging rehearsal, existing-record reconciliation and coordinated migration/queue rollout have been approved. No live sends or changes are made by this branch.

Sent-item progress remains unimplemented: persist a batch/campaign and its intended recipient total and outcomes, then query it with owner authorization and reload from D1. Distinguish pending, provider-accepted, delivered, failed, suppressed and unknown; never equate queue acceptance or an aggregate count to inbox delivery. Handle partial queue submission and deletions without changing the original denominator.
