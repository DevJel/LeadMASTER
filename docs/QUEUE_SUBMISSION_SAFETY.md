# Queue submission safety — partial mitigation

This branch changes producer outcome reporting, not the SMTP transport or the queue consumer. After a queue call throws, acceptance can be uncertain; the dashboard receives the batch ID and a warning not to resend. Rows are deliberately not mass-marked failed, since some may already be queued, processing or accepted. If queue calls all return successfully, later activity/notification write failures no longer make the API claim submission failed. The developer API uses its existing idempotency key and likewise reports an uncertain submission without marking the message failed. A missing queue binding is a definite pre-submission failure.

**This is not the requested full solution and is not production-ready:**

- There is no durable outbox, per-chunk persisted submission state, automatic reconciliation, or dashboard idempotency key. If a later chunk fails, unattempted records can remain shown as queued. Investigate the batch and actual provider/queue evidence; do not blindly resend or mark all records failed.
- The queue consumer itself still requires a durable claim and crash-safe handling between SMTP acceptance and the D1 status update. Post-send storage failures or concurrent/replayed deliveries may cause incorrect status or duplicate sends. Do not claim exactly-once delivery.
- The current composer re-enables its submit button after an error; the warning alone does not prevent a user resubmitting. UI controls and real authenticated end-to-end tests remain required.
- A developer idempotency-key replay reports the stored `sending` state for an uncertain submission. It must not be interpreted as proof that a queue message exists. A different idempotency key can duplicate the send.
- Best-effort activity and notification writes can be lost; operational logging and reconciliation are still needed.

Before deployment, test the dashboard endpoint and queue consumer with fault injection in isolated staging, verify monitoring and rollback, and review API-client handling of the new `submission_unconfirmed` response. No live email should be sent without explicit approval. Existing uncertain or failed production records require individual reconciliation against provider events before remediation.
