# LeadMASTER Reporter/Worker

The daily Reporter/Worker runs inside the production LeadMASTER Worker so it can use the existing D1 database, the same SES `EmailCoordinator` Durable Object, and the same primary-admin identity. It does not create a second SMTP account or accept a report recipient from an API request.

## Schedule and recipient

- Cron: `0 0 * * *` (00:00 UTC / 08:00 Asia/Kuala_Lumpur).
- Report date and display date use `REPORTER_TIME_ZONE`, currently `Asia/Kuala_Lumpur`.
- Recipient: the configured `ADMIN_EMAIL` secret-store binding only.
- Sender: existing LeadMASTER SES coordinator and existing `SES_FROM_EMAIL` sender configuration.
- No CC, BCC, SMTP fallback, second provider, or recipient override.
- A daily report is idempotent. The D1 ledger prevents a second report after an accepted or ambiguous send outcome.

## Report content

1. GitHub repository and default branch reachability.
2. Latest GitHub Actions run for each workflow on `main`.
3. Open GitHub issues and pull requests.
4. Cloudflare runtime checks: D1 schema/query, R2 inbound-mail binding, mail Queue producer binding, Workers AI binding and the shared SES coordinator.
5. App route checks: public auth configuration, session endpoint, protected dashboard redirect, and expected unauthorized responses for workspace, mailbox, templates, sending, batches, activity, notifications, audience, profile and developer-key routes.
6. Admin login security-alert path. The existing successful OTP sign-in flow already sends the branded security alert to the same configured admin through the SES coordinator.
7. Optional account-level Cloudflare resource inventory when `CF_API_TOKEN` is configured.

The report does not read mailbox bodies, recipient lists, attachments, passwords, OTPs, SMTP credentials, API keys or other secret values. It does not send test emails.

## Status and colors

| Status | Color | Meaning |
|---|---|---|
| Healthy | Green | Check passed |
| Fixed | Green | First check failed transiently; automatic retry passed |
| Moderate | Yellow | Partial visibility, non-critical issue or work in progress |
| Needs Attention | Orange | A production check failed and requires investigation |
| Needs Manual Action | Red | Required access, configuration or a human action is missing |
| Unable to Fix | Dark red | A required dependency is unavailable or cannot be safely repaired by this worker |

The overall status takes the highest outstanding severity. A report is not marked healthy when a required control-plane audit is unavailable.

## Safe remediation policy

The worker retries transient HTTP checks once. It reports `Fixed` only when the retry verifies recovery. It does not automatically edit source code, merge pull requests, change DNS, rotate credentials, alter access policies, mutate mailbox data, send messages to users, or deploy a Worker. Those operations require review and a separate authorized change. Failed or ambiguous report sends are recorded so the daily scheduler does not blindly create duplicate emails.

## Cloudflare account audit permission

Without `CF_API_TOKEN`, the report can validate the app's live Worker runtime and bound D1/R2/Queue/SES services, but cannot inspect the full Cloudflare account control plane. To enable that additional audit, create a Cloudflare API token restricted to the **Lead Master Web App** account (`967aa086112f862ba9f50ccf7aa09246`) with read-only permissions:

- Workers Scripts Read
- D1 Read
- Queues Read
- Workers R2 Storage Read

Add the token as the `CF_API_TOKEN` Worker secret in Cloudflare. Never use a Global API Key. The value is not committed to GitHub or included in report content.

GitHub monitoring uses the public `DevJel/LeadMASTER` repository API. If the repository is made private or GitHub rate limits prevent the check, add a least-privilege `GITHUB_TOKEN` secret with repository read access.

## Admin endpoints

Both endpoints require the authenticated primary administrator session:

- `GET /api/admin/reporter/status` — returns recent report ledger metadata.
- `POST /api/admin/reporter/run` — requests the current day's report immediately. It cannot override an accepted or ambiguous send outcome.

## D1 ledger

Migration `0020_leadmaster_daily_reporter.sql` creates `leadmaster_reporter_runs`, which stores report date, counts, safe check summaries, send outcome and error summary. It does not store SMTP secrets or mailbox content.
