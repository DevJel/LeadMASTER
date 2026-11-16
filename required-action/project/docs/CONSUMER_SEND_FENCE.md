# Queue consumer send fence — proposed, not released

Migration `0009_mail_send_claims.sql` introduces a durable `(source, request_id)` claim. The consumer creates the claim atomically before SMTP. A duplicate or redelivery cannot claim the same request and is acknowledged without another SMTP attempt. SES acceptance, definite non-acceptance, or an uncertain outcome is saved with the message state and claim in a D1 transaction. An exception after the claim but before the result is saved leaves `started` for manual reconciliation, rather than automatically sending again. Activity, notification and accepted-webhook writes are best-effort and can be lost.

## Limits and operational impact

- The fence deliberately favors avoiding duplicate email over guaranteed delivery: a process crash after claiming but before SMTP can leave a message unsent and stuck. There is no automated recovery or alert yet. Monitor `started` claims and reconcile against provider, queue and application evidence; do not delete or reset claims automatically. Never blindly resend.
- This is not a transactional outbox, exactly-once delivery, a scheduling system or a complete producer-side/idempotency solution. Queue delivery, SMTP acceptance and inbox delivery are different states. Post-acceptance D1 failure leaves the row as `sending` until investigated.
- Existing messages sent by an older consumer have no claim. Deployment overlap with an old consumer, or queued/in-flight messages from before the switch, could defeat the fence. Do not roll out until old consumers are quiesced and outstanding messages are reconciled. A rollback to an older consumer also bypasses the fence and can resend; it requires stopping/draining and explicit reconciliation.
- Definite pre-DATA failures are marked failed rather than retried automatically. Transient failures may require an operator-approved new send after investigation. Never treat a generic error as proof of non-acceptance.
- Missing migration prevents the new consumer from sending and causes queue retries; prolonged failure can route messages to a dead-letter queue. Monitor it and keep queue backlog limits and recovery procedures ready.
- Suppression-at-dispatch and reliable activity, notification and webhook delivery are separate outstanding requirements. A claim prevents retries of the same message ID, not a user creating a new ID.

## Review and release gates

1. Finish producer outbox/idempotency and reconcile existing uncertain, queued and failed records without sending or exposing recipient data. Set up isolated staging with separate D1, queue, R2 and non-production mail transport; use synthetic data.
2. Rehearse migration against a copy, verify a recoverable backup, then test concurrent deliveries, timeouts, process termination at every transition, D1 faults, dead-letter behavior and old/new consumer overlap. Monitor stale claims and validate rollback without re-sending.
3. Apply migration before the consumer only after explicit approval; coordinate a pause/drain of the old consumer and record the deployment version. Confirm schema and monitor claims, queue, delivery and errors. Live messages require separate approval.
4. No automatic production migration, deployment, queue draining, resend or rollback is authorized by this document.

For a read-only count of claims needing investigation:

```sql
SELECT state, COUNT(*) AS count FROM mail_send_claims GROUP BY state;
```

A `started` claim is neither proof of delivery nor proof of non-delivery. Check age with `claimed_at` and investigate each request in a restricted operational context.
