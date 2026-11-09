# Mailbox control review — 9 November 2026

This is a focused source and synthetic-browser review, not a complete dashboard or production acceptance audit.

| Control | Route and effect | Current behavior in this branch |
| --- | --- | --- |
| Sending / Receiving / Suppressions tabs | `GET /api/admin/mail` with `folder`; navigation is local | Reloads the server list on tab changes; displays loading, empty and retryable error states. |
| Search | `GET /api/admin/mail` with `q`; no durable write | Updates the server query. |
| Date, status, API-key filters; Export | No supported implementation in this screen | Hidden rather than implying filtering or producing an export. |
| Message row | `GET /api/admin/mail/:id`; inbound reads can mark a message read in D1 | Shows an opening state and recoverable error. |
| Move to Deleted | `PATCH /api/admin/mail/:id` with `action: delete`; existing D1 soft delete | Requires confirmation, disables repeated submission while pending, and reloads from the server. A network or server failure is described as an unconfirmed outcome; return to the list to check before retrying. |

Local mocked browser checks covered list failure/retry, search, detail failure, confirmation cancellation, successful reload and an uncertain server response, at desktop and mobile widths. CI source tests guard key changes. These checks do not exercise an authenticated production Worker, live data, keyboard/screen reader accessibility, Android, permanent or bulk deletion, or every dashboard control. Do not claim complete release readiness. Existing queue and schema rollout gates remain open. No schema or login configuration is changed in this branch.
