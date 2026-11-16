# SMTP sender selection — staging only

The unmounted selection helpers list only account-owned, currently verified, non-revoked connections. A selection is pinned to a connection ID, revision and From address; tests reject another account, stale revision, edited address, and revocation. These helpers expose no credentials.

They are not connected to the composer, queue, or any sending transport. A pre-dispatch check alone cannot prevent a connection edit from racing with a send. Before release, design and test an atomic send/credential-version fence, preserve existing recipient claims, suppression, idempotency and uncertain-delivery behavior, and ensure admin queue records carry authoritative account ownership. The existing admin queue does not currently expose account ownership in the consumer query. Never use a selected sender until these conditions and the transport security requirements are met.
