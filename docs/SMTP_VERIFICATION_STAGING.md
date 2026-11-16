# SMTP verification — incomplete staging work

The unmounted verification coordinator uses an account-scoped D1 lease and cooldown to limit concurrent tests, decrypts only the requested account and connection's credentials, and records success only if the connection revision remains current, the connection is not revoked, and the lease has not expired or been superseded. A failed test marks the same revision unverified. Responses are sanitized and omit credentials.

The unmounted settings handler has a test action and the unmounted settings panel has a test button. The handler fails closed unless its caller explicitly supplies a probe. No production caller supplies one; no socket factory meeting the required destination, DNS-rebinding and TLS identity guarantees exists. The probe, handler, UI, and new migration 0018 are not deployed. Do not apply the migration or connect this action to a Worker until security review and real Worker/D1/SMTP integration tests are complete.

Tests use synthetic probes and SQLite, not a live SMTP server. A successful SMTP authentication test would not prove sending or delivery. Sender selection and message dispatch are not implemented.

## Transport compatibility risk to resolve before release

The Cloudflare TCP documentation says localhost/private destinations and Cloudflare IPs are disallowed, but does not establish a complete application SSRF policy or a way to pin a validated destination while preserving the original TLS hostname. An open workerd report describes `startTls({ expectedServerHostname })` failing to apply SNI when connecting by IP at the production edge; this is a reported runtime issue, not a verified test of this application. A hostname-based control reportedly worked. Do not disable hostname verification, assume DNS prechecks prevent rebinding, or treat local-only tests as production proof. Establish and independently test a complete safe transport boundary first.

References: https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/ and https://github.com/cloudflare/workerd/issues/6903
