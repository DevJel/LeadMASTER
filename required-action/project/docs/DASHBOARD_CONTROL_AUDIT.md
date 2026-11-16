# Dashboard control audit — initial, not exhaustive

Source: `src/Mandatory LeadMASTER Dashboard.html`, baseline main commit `9e8407f6f3203ddea1ca40a6fb7897b071e6d34b`. The canonical dashboard is a bundled React application; this is source inspection, not an authenticated browser acceptance test. No user data was used. Android uses the shared web UI; real device behavior remains unverified.

| Dashboard control | Source behavior / endpoint | Persistence and gap |
| --- | --- | --- |
| Emails: Sending / Receiving / Deleted / Suppressions | Tab state selects a folder in `GET /api/admin/mail`; search passes `q` | Deleted is now a first-class mailbox view. The client reloads the selected folder when the tab/search changes. |
| Emails: date, status and API-key dropdowns | Update local state, but those values are not passed to the live-mail fetch | Misleading UI-only controls; wire with tested server-side filters or disable/hide. |
| Emails: Export data | Displays a toast saying export was prepared | No file is generated. Disable/hide or implement a real authorized export. |
| Emails: Deleted row actions | `PATCH /api/admin/mail/:id` with `action: restore` or `action: permanentDelete` | Implemented on the feature branch with separate restore and irreversible-delete confirmations. The Worker only accepts permanent deletion for records already in Deleted; inbound object cleanup uses the existing retry-safe claim. Production acceptance remains pending. |
| Emails: message row | `GET /api/admin/mail/:id` | Inbound detail reads can mark the message read in D1. Handle request failures and pending states. |
| Emails: Move to Deleted | `PATCH /api/admin/mail/:id` with `action: delete` | Implemented on the feature branch with explicit confirmation, pending/error state, and authoritative mailbox refresh. The message is soft-deleted, not immediately destroyed. |
| Compose | Modal sends `POST /api/admin/send` | Creates D1 rows and enqueues messages. No HTML, attachments, groups or scheduling; partial enqueue uncertainty remains a release blocker. |
| Audience: Add suppression | `POST /api/admin/unsubscribes` | D1 insert; branch repairs server validation. Client updates local state instead of reloading, and the current response does not include an ID. Add pending state and authoritative reload. Suppression list is not contact/group management. |
| Audience: search and All/Unsubscribed chips | Local state filters the loaded suppression list | Not a write; local navigation state is acceptable but list is bounded by server response. |
| Templates: Compose / HTML preview / Open Emails | Opens current composer, isolated local preview, or navigates | Preview explicitly says it is not saved; no template CRUD. |
| Broadcasts: Compose broadcast | Opens current composer | Same immediate-send backend; no scheduled campaign. |
| API keys: Create key | `POST /api/developer/keys` | D1 insert; one-time secret reveal; client appends local row, without explicit pending state. Refresh server list; keep secret out of logs. |
| Webhooks: Create, delivery history, revoke | `POST /api/admin/webhooks`, `GET /api/admin/webhooks/:id/deliveries`, `DELETE /api/admin/webhooks/:id` | D1 writes/history. Revoke uses a browser confirmation; add per-action pending states and verify server refresh. DNS rebinding/SSRF hardening remains open. |
| Profile: Save changes | `PATCH /api/account/profile` | D1 account name; add explicit pending/error/authoritative reload and accessible feedback. |
| Theme / navigation | Local UI state | Intentionally local; persist only if product requirement covers user preference and define per-account/device semantics. |
| Danger zone / team management | Disabled/unavailable | No deletion or team management backend. |

This audit is partial. Suppression entries intentionally have no delete control because removal would allow future sending; API keys and webhooks are revoked rather than erased; activity history is retained. Repeat for every rendered navigation section, modal, filter, secondary action, disabled state, keyboard path and Android entry point, with endpoint, authorization, server writes and tests. Do not report unsupported controls as complete.

## Suppression validation branch

The production source baseline used an over-escaped regex that rejects ordinary email addresses. This branch replaces it with a tested basic validation function, keeps same-origin and authenticated admin checks in the existing route, and does not change schema or UI. It does not prove actual mailbox ownership or consent. Local unit tests cover ordinary addresses and malformed inputs; production integration remains unverified. Do not deploy without approval and the usual staging/rollback checks.
