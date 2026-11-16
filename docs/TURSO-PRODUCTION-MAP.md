# LeadMASTER production database map

## Production decision

Turso is the sole production application database. The production database is the fresh-reset database in AWS ap-southeast-2 (Sydney):

- Database: `leadmaster`
- URL: `libsql://leadmaster-devjel.aws-ap-southeast-2.turso.io`
- Worker binding: `TURSO_URL`
- Authentication binding: `TURSO_AUTH_TOKEN`
- Secret source: Cloudflare Secret Store `leadmaster-secrets` (store ID `e4c5eeca43e24f1fa21e6f808180e0dc`); the token value is never stored in source or this document.
- Client: `@libsql/client/web`

No D1 data was imported. The production D1 binding was removed from the active Worker configuration. The previous production D1 database ID `246db481-9bff-4088-8dcc-b810138aea68` is not present in the target Cloudflare account (Cloudflare returns 404); the account's D1 database listing is empty.

## Runtime mapping

```mermaid
flowchart TD
  Browser[LeadMASTER web and mobile clients] --> Main[leadmaster Worker]
  Main --> Adapter[src/turso-database.mjs]
  Adapter --> Turso[(Turso leadmaster<br/>AWS ap-southeast-2)]
  Main --> Queue[leadmaster-mail-send queue]
  Queue --> Consumer[leadmaster-mail-queue-consumer]
  Consumer --> Adapter
  Consumer --> Turso
  Queue --> Failed[leadmaster-mail-failed-consumer]
  Failed --> Adapter
  Failed --> Turso
  Inbound[leadmaster-inbound-mail Worker] --> Adapter
  Inbound --> Turso
  Main --> DO[EmailCoordinator Durable Object]
  Main --> R2[leadmaster-inbound-mail R2 bucket]
```

| Production Worker | Database mapping | Other relevant bindings |
| --- | --- | --- |
| `leadmaster` | `TURSO_URL`, `TURSO_AUTH_TOKEN` | Secret Store auth/SES/Turnstile, EmailCoordinator, inbound R2, send queue |
| `leadmaster-mail-queue-consumer` | `TURSO_URL`, `TURSO_AUTH_TOKEN` | EmailCoordinator, SES settings |
| `leadmaster-mail-failed-consumer` | `TURSO_URL`, `TURSO_AUTH_TOKEN` | — |
| `leadmaster-inbound-mail` | `TURSO_URL`, `TURSO_AUTH_TOKEN` | inbound R2 |

The `AUTH_DB` name used by existing application modules is an internal compatibility facade supplied by `withTursoDatabase(env)`. It is not a Cloudflare D1 binding.

## Schema and reset

The schema is provisioned by ordered SQL migrations `0001` through `0021`. The `leadmaster_schema_migrations` ledger records all 21 versions. The application schema includes accounts and memberships, auth challenges/sessions/rate limits, lead records, inbound and sent mail, audience groups/contacts, templates/drafts, delivery events, SMTP connections, developer API keys/requests/webhooks, mail queues/claims/deduplication/notifications, reporter runs, and workspace activity.

The reset was intentionally clean: no D1 rows were copied. Application data tables were empty at initial validation; authentication challenge rows may appear as real login flows run.

## Source-of-truth files

- `src/turso-database.mjs`: Turso client and D1-compatible query facade.
- `worker.js`: initializes the facade for fetch, scheduled, and email events.
- `workers/mail-queue-consumer.js`: initializes Turso before queue processing.
- `workers/mail-failed-consumer.js`: initializes Turso before failed-message processing.
- `migrations/0001_core_schema.sql` and `migrations/0002_*.sql`–`migrations/0021_*.sql`: schema history.
- `scripts/migrate-turso.mjs`: ordered migration runner.
- `wrangler.jsonc`, `wrangler.mail-master-web-app.jsonc`, `wrangler.mail-master-web-app.queue-consumer.jsonc`, `wrangler.mail-master-web-app.failed-consumer.jsonc`: production Turso bindings.

## Production validation recorded

- All four production Worker scripts have active deployments and 100% traffic on their latest deployment.
- All four deployed script bundles include the Turso client integration and contain no D1 database reference.
- All four production Worker binding lists contain the same Turso URL and Secret Store token binding.
- The Turso schema contains the expected application tables and migration ledger.
- `PRAGMA foreign_key_check` returned no violations.
- The target Cloudflare account's D1 database listing is empty; lookup of the previous production D1 ID returns 404.

## Environment separation

Legacy/staging Wrangler configurations must not be pointed at this production database. Provision a separate staging Turso database and token before enabling staging. This avoids staging tests writing to production data.
