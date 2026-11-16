# Developer email idempotency rollout

This change stores a versioned SHA-256 fingerprint of the canonical submitted email fields with each newly created request. A matching replay returns the existing request; a different payload returns 409 without enqueuing. A unique database constraint remains the final concurrent-submission fence. A competing request may receive 409 while the winner is being recorded; retry with the same key and payload to read the stored status.

The fingerprint is intentionally not backfilled: persisted account-derived sender metadata cannot prove what the caller originally submitted. Requests created before the migration have a null fingerprint and return 409, including their original request ID and status, for manual reconciliation. This is an intentional compatibility change to prevent a false match. A new key can create a duplicate; do not use one until the earlier request is reconciled.

## Release gates

1. Validate migration `0021_developer_request_fingerprint.sql` in an isolated environment using representative legacy records; confirm existing rows, constraints and account ownership are preserved. Verify a current backup and the established database recovery procedure.
2. Apply the additive migration **before** deploying the matching worker. Old workers can continue to insert rows with null fingerprints during a rolling deployment, and those rows will follow the legacy 409 path. Do not use the new worker against a database without the migration.
3. In isolated staging, verify same-payload replays, changed-payload conflicts, concurrent submissions, a legacy 409, scoped status access, queue failure and uncertain queue acceptance. Review affected API clients for legacy 409 handling. Avoid real recipients without explicit approval.
4. After deployment, verify the running version and perform authorized non-destructive checks. Monitor 409 responses and queue health. A fingerprint match does not prove queue acceptance, delivery, or exactly-once transport.
5. Roll back the worker via the established deployment path if required; the additive column may remain. **An older worker does not compare fingerprints**, so rollback removes this protection and should be treated as a security regression. Do not drop the column or delete request records without a separate approved data migration.
