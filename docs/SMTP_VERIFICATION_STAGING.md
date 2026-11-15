# SMTP verification — incomplete staging work

The unmounted verification coordinator uses an account-scoped D1 lease and cooldown to limit concurrent tests, decrypts only the requested account and connection's credentials, and records success only if the connection revision remains current, the connection is not revoked, and the lease has not expired or been superseded. A failed test marks the same revision unverified. Responses are sanitized and omit credentials.

The unmounted settings handler has a test action and the unmounted settings panel has a test button. The handler fails closed unless its caller explicitly supplies a probe. No production caller supplies one; no socket factory meeting the required destination, DNS-rebinding and TLS identity guarantees exists. The probe, handler, UI, and new migration 0018 are not deployed. Do not apply the migration or connect this action to a Worker until security review and real Worker/D1/SMTP integration tests are complete.

Tests use synthetic probes and SQLite, not a live SMTP server. A successful SMTP authentication test would not prove sending or delivery. Sender selection and message dispatch are not implemented.
