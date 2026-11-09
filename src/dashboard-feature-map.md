# Mandatory LeadMASTER Dashboard — production integration map

**Canonical UI:** `src/Mandatory LeadMASTER Dashboard.html`  
**Production mirror:** `public/dashboard.html`  
**Authenticated route:** `/dashboard.html`

## Visual contract

The mandatory HTML is the authoritative React dashboard. Preserve its component tree, embedded styling, layout, typography, spacing, icons, responsive breakpoints, side navigation, mobile bottom navigation, drawers, cards, tables and interactions. API work must update data and behavior without redesigning the interface. The public mirror must remain byte-for-byte identical to the canonical source; `npm run build:assets` performs that synchronization and regenerates `src/static-assets.mjs`.

## Live integrations now connected

| Dashboard feature | Production API | Behavior |
|---|---|---|
| Account identity | `GET /api/auth/session`, `GET /api/account/profile` | Authenticated account, owner display name, account email and workspace name. |
| Overview | `GET /api/admin/mail?folder=counts`, `GET /api/admin/activity` | Live mailbox and sending-queue counts plus actual workspace activity. |
| Emails | `GET /api/admin/mail?folder=...`, `GET /api/admin/mail/:id`, `PATCH /api/admin/mail/:id`, `POST /api/admin/send` | Existing inbound mailbox, sent/queued states, message detail, mailbox actions and composer/send queue. |
| AI reply assistance | `POST /api/admin/mail/:id/suggest` | Existing account mailbox reply suggestion flow. |
| Audience / suppression | `GET/POST /api/admin/unsubscribes` | Displays the actual do-not-contact list and allows an administrator to add a suppression. It is not a contact or marketing-list manager. |
| Inboxes | Existing inbound mailbox | Shows the one dedicated inbound mailbox and links to the Receiving view. Additional inbox provisioning is not exposed. |
| Broadcasts | `GET /api/admin/mail?folder=sent`, `POST /api/admin/send` | Displays accepted sends and opens the existing queue-backed composer. The endpoint accepts up to 500 recipients. |
| Metrics | `GET /api/admin/mail?folder=counts` | Uses real operational counts only: accepted sends, inbox, queue, unsuccessful and bounce/complaint counts. |
| Activity | `GET /api/admin/activity` | Workspace activity events; not opens/clicks or campaign engagement. |
| API keys | `GET/POST /api/developer/keys`, `DELETE /api/developer/keys/:id` | Account-scoped key management. Full key is revealed once. Optional `webhook:manage` scope is explicit, not granted by default. |
| Webhooks | `GET/POST /api/admin/webhooks`, `DELETE /api/admin/webhooks/:id`, `GET /api/admin/webhooks/:id/deliveries` | Account-scoped create/list/revoke/history. Creation requires an active account API key with `webhook:manage`. Signing secret is shown once. Supported event types are `email.accepted`, `email.failed`, and `email.unknown`. |
| Settings | `GET/PATCH /api/account/profile` | Only the account owner display name is editable. Email, workspace and device timezone are read-only in this UI. |
| Session | `POST /api/auth/logout` | Uses the existing server logout endpoint. |

## Features deliberately not represented as live

These sections remain visible in the mandatory navigation but use honest unavailable states or only existing data. Do not add sample rows, local-success toasts or invented statuses.

- **Saved templates:** no user-managed template CRUD API. System OTP/security templates are not a saved customer template library.
- **Contacts / audience segments:** no contacts, list or segment CRUD service. The only current audience-related backend is the do-not-contact/suppression list.
- **Multiple inboxes:** only one dedicated inbound mailbox is available; no inbox provisioning or forwarding management API exists.
- **Draft and scheduled campaigns:** the current backend queues immediate sends only. No saved campaign, scheduler, recipient-segment or campaign lifecycle API exists.
- **Automations:** no workflow persistence, trigger engine, scheduler or execution service is enabled.
- **Engagement analytics:** opens, clicks, attribution and campaign time-series are not collected. Do not render estimated rates or charts.
- **Domain verification:** sender-domain allowlist is not a DNS verification API. Never claim DKIM/SPF status or invent DNS records.
- **Team management / account deletion:** not enabled for the configured account.
- **Persistent onboarding checklist:** current checklist is a convenience view derived from observed setup signals, not a persisted workflow record.

## Account and security rules

1. Use the authenticated LeadMASTER session and the currently selected account. Do not use preview, operator, shared or other-user data.
2. Keep every tenant-owned query and mutation account-scoped. The server must authorize ownership; the browser must not filter global results.
3. Cookie-authenticated mutations must retain same-origin checks and server-side validation.
4. Never expose API-key hashes, full keys after initial creation, webhook secrets after initial reveal, or another account's resource existence.
5. A queue acceptance is not proof of recipient delivery. Display the actual backend state.
6. Keep the human login, Turnstile, email OTP and session controls unchanged.
7. Do not enable MCP; production agent access remains the documented account-scoped REST API.

## Android parity

The Android WebView uses the same authenticated dashboard and backend. Its native bottom navigation mirrors the mandatory dashboard mobile destinations: Home (`home`), Emails (`emails`), Audience (`audience`), Metrics (`metrics`) and Profile (`profile`). Other modules remain accessible through the dashboard navigation drawer. Back returns to Home before leaving the workspace. When dashboard section IDs or connected behavior change, update and build the Android companion in the same branch.

## Release verification

- `npm test`
- `npm run build:assets`
- `node --check worker.js`
- `node --check src/developer-api.mjs`
- `node --check src/developer-webhooks.mjs`
- `node scripts/capture-screenshots.mjs`
- Android APK build when Android sources change
- Desktop and mobile screenshot review against the mandatory dashboard
- Authenticated production smoke tests for mailbox, send queue, API keys, suppression and webhooks before claiming end-to-end success

Do not deploy a dashboard change while tests or visual checks are failing. Keep a rollback path until the release acceptance checks pass.
