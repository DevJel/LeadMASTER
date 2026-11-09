# Production release record — 2026-11-10

## Scope and release separation

This release uses an isolated staging environment in Cloudflare account **Jelvan - Projects - Works**. The existing production Worker, production queues, R2 bucket, sender, credentials and user records are preserved. No production message was replayed and no email was sent by the staging tests.

The previously named `leadmaster-staging-synthetic-20261109` D1 was found to contain pre-existing records and additional schema without a migration ledger. It was not used, reset, overwritten or deleted. A new release-isolated database was created instead.

## Staging resources

| Resource | Value |
|---|---|
| Main Worker | `leadmaster-staging-release` |
| Main URL | https://leadmaster-staging-release.bolekpadjelvan.workers.dev |
| Queue consumer | `leadmaster-staging-mail-queue-consumer` |
| Failed-message consumer | `leadmaster-staging-mail-failed-consumer` |
| D1 | `leadmaster-staging-release-20261110` |
| D1 database ID | `78cfdd79-cd90-4c06-9d1e-2f391a3496d1` |
| Send queue | `leadmaster-staging-mail-send` |
| Failed queue | `leadmaster-staging-mail-failed` |
| R2 bucket | `leadmaster-staging-inbound-mail` |
| Source branch | `feature/leadmaster-staging-20261110` |

The release D1 was initialized from production schema metadata only; production records were not copied. Migrations 0002–0008 were recorded as the baseline. Migrations 0009–0012 were rehearsed in staging and verified in the ledger.

Staging uses generated synthetic secrets and a deliberately invalid SMTP hostname (`smtp.invalid`). Its Turnstile secret/site key are non-production placeholders. Do not enable real outbound email in staging without separately provisioning valid staging-only provider credentials and an approved test mailbox.

## Migration results

The production D1 database `leadmaster-auth` (ID `e2ea3d34-1fca-46a9-b70e-1ca07d78f48e`) had migrations 0002–0008 recorded before this release. The following additive migrations were applied sequentially and verified:

| Ledger ID | Migration | Result |
|---:|---|---|
| 8 | `0009_mail_send_claims.sql` | Applied; send-claim table and pending index verified |
| 9 | `0010_email_templates.sql` | Applied; account templates, index and `admin_sent_mail.html_body` verified |
| 10 | `0011_audience_groups.sql` | Applied; contacts, groups, memberships and indexes verified |
| 11 | `0012_mail_batch_progress_index.sql` | Applied; batch progress index verified |

The production migration ledger is now continuous from 0002 through 0012. No production records were removed or rewritten by these migrations.

## Queue safety and pre-release state

Before production migrations, the send queue and failed queue both reported zero backlog. The production sent-mail table contained six records with `accepted` state and three records with `failed` state at the time of inspection. These records were not retried.

A D1 Time Travel bookmark was recorded before schema changes:
`0000006f-00000000-0000511e-286c2ac60a71fcf1e4dba623386031ab`.

A D1 export operation reached `complete` at that bookmark. The export API response did not expose a downloadable SQL artifact in the connected tool response; therefore this record does not claim that a separate off-account backup file or restore rehearsal was completed. R2 objects are not restored by a D1 restore.

## Authentication and transport bindings

The production main Worker continues using the existing Secrets Store credentials. The queue consumer configuration now includes the existing shared `SESSION_SECRET` binding mapped to the `ADMIN_JWT_TOKEN` Secrets Store entry. The secret value is not copied into source control or this document.

Production SMTP credentials and the configured sender were not rotated or replaced. The configured sender identity, SES-region verification, DKIM/SPF/DMARC alignment, account quota and real inbox placement still require an approved provider-side verification. Queue or SMTP acceptance must not be described as confirmed delivery.

## Source and CI evidence

The release work is isolated in `feature/leadmaster-staging-20261110`. GitHub Actions CI succeeded for the latest feature-branch commit at the time of this record. The workflow covers `npm ci`, `npm test`, static asset generation, syntax checks and screenshot generation.

Cloudflare Workers Builds has separate branch-scoped staging triggers and main-branch production triggers for the app and queue consumers. Staging triggers must remain limited to the staging branch. Production triggers must remain limited to `main`.

## Acceptance still required

The following items remain release/operations checks and must not be assumed complete from schema and build evidence alone:

- Authenticated browser login through real Turnstile and SES OTP, session persistence, expiry and logout.
- Browser inspection of the protected dashboard and all static asset routes while unauthenticated.
- Actual queue consumer failure injection, uncertain SMTP outcomes, D1 failure/restart recovery and dead-letter reconciliation on staging.
- Real SESv2 raw MIME transport and attachment support; the current SMTP module is not a substitute.
- An account-wide crash-safe sender throttle shared with direct OTP/security-alert senders and any other application using the same SES account and region.
- Approved live email test to an authorized mailbox; no real email was sent during staging setup.
- Authenticated desktop, mobile and Android acceptance; keyboard/screen-reader/contrast/reduced-motion checks.
- Full backup artifact retention and a rehearsed D1/R2 recovery procedure.
- Final dashboard control-by-control audit, including filters/export, destructive confirmations, drafts, template edit/delete, contact consent/provenance, campaign scheduling/cancellation and progress/reconciliation.
- Signed-session/JWT policy review: the current production session design is opaque, random, server-stored sessions; it is not a JWT implementation.
- Independent security review of webhook DNS rebinding/SSRF defenses, account ownership, retention, quotas, security headers and log redaction.

This record separates completed infrastructure actions from application capabilities and acceptance tests that remain outstanding. Do not label LeadMASTER fully production-ready until the relevant runtime and browser tests pass and the outstanding release gates are closed.
