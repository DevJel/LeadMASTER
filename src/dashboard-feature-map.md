# Mandatory LeadMASTER Dashboard — production integration map

**Canonical UI source:** `src/Mandatory LeadMASTER Dashboard.html`

**Production route:** `/dashboard.html` (authenticated by `worker.js`).

## Non-negotiable visual contract

The mandatory HTML is the design source of truth. When it becomes the production dashboard, retain its React component structure, layout, responsive breakpoints, typography, spacing, icons, colors, navigation behavior, cards, tables, drawers, bottom navigation and all visual states. API integration must change data and actions, not restyle or reimplement the UI. Any unavoidable UI change requires explicit approval.

The mandatory file is currently a local preview, not a production-ready dashboard. Its component contains hardcoded demo contacts, delivery events, campaigns, domains, API keys, webhook endpoints, automation definitions, profile values and toast messages that claim local actions were saved. Do not publish those as live account data or imply that a preview-only action succeeded.

## Existing production backend contracts

| Dashboard area | Existing production source | Current capability / limitation |
|---|---|---|
| Homepage / overview | `GET /api/auth/session`, `GET /api/admin/mail?folder=counts`, `GET /api/admin/activity`, `GET /api/admin/notifications` | Account identity, operational mail counts, activity and notifications. No campaign or engagement metrics. |
| Emails / sending | `GET /api/admin/mail?folder=sent`, `POST /api/admin/send` | Admin can queue up to 500 unique recipients per batch; SMTP queue is rate-limited. |
| Emails / receiving | `GET /api/admin/mail?folder=inbox`, `GET /api/admin/mail/:id`, `PATCH /api/admin/mail/:id` | Dedicated inbound mailbox, message detail, read/archive/delete/restore and source download. |
| Email delivery folders | `GET /api/admin/mail?folder=counts|bounced|unsuccessful|archived|deleted` | Operational delivery and mailbox states; accepted is not equivalent to delivered. |
| AI reply assistance | `POST /api/admin/mail/:id/suggest` | Uses the configured Cloudflare AI binding and account-owned correspondence context. |
| Suppressions | `POST /api/admin/unsubscribes`, `GET /api/admin/mail?folder=unsubscribed` | Add suppression and list suppressed entries through the mail folder. There is no general contact-list service. |
| API keys | `GET/POST /api/developer/keys`, `DELETE /api/developer/keys/:id` | Real account-scoped key creation, listing and revocation. Full secret is shown once. |
| Email API | `/api/v1/accounts/:accountId/emails` | One recipient per developer API request, API-key scoped, idempotency supported. |
| Webhooks | `/api/v1/accounts/:accountId/webhooks` | API-key scoped create/list/revoke and delivery history. No admin-session dashboard adapter yet. |
| Profile / settings | `GET/PATCH /api/account/profile`, `GET /api/auth/session` | Only the account owner's display name is editable through this profile API. Email, team and timezone are not editable here. |
| Activity / logs | `GET /api/admin/activity` | Workspace audit events, not opens/clicks or a full provider event analytics stream. |

## Preview-only areas requiring backend work or honest unavailable states

- **Templates:** no user-managed template CRUD API. `src/email-templates.mjs` contains system email templates; it is not a saved-template library.
- **Audience:** no contacts/list/segment CRUD schema or API. Suppression records are not a marketing audience.
- **Inboxes:** one dedicated inbound address is documented; no multi-inbox provisioning or routing management API.
- **Broadcasts:** immediate bulk send is supported by `/api/admin/send`; saved campaigns, scheduling, audience targeting and campaign analytics are not implemented.
- **Automations:** no workflow persistence, trigger engine, scheduler or execution API.
- **Metrics:** delivery counts are available; open/click analytics are not implemented. Never render sample percentages or charts as account metrics.
- **Domains:** sender policy accepts configured domain families, but there is no domain verification or DNS-check API. Never display fabricated DKIM/SPF status.
- **Webhooks:** existing public developer API requires a scoped API key; a secure account-session adapter is needed if the dashboard manages these directly.
- **Onboarding:** the preview checklist is local state; do not claim setup steps were verified unless backed by an API result.

## Required implementation sequence

1. Keep the mandatory HTML unchanged as the visual baseline and capture desktop/mobile reference screenshots.
2. Map each UI page and action to an existing authenticated endpoint, or implement the missing account-scoped backend and D1 migration before enabling it.
3. Replace every demo identity, sample record, fabricated metric, fake key, fake webhook and local-success toast with authenticated live data, a true empty state, or an explicit unavailable state.
4. Preserve all existing production capabilities (mailbox, composer/send queue, AI reply suggestion, delivery folders, notifications, profile, API keys, webhooks) while migrating them into the mandatory visual shell. Keep the former dashboard as a protected rollback/compatibility page until parity tests pass.
5. Keep every database query and mutation account-scoped. Require same-origin checks for cookie-authenticated mutations, validate payloads, use prepared statements, and never expose API keys or webhook signing secrets after their one-time creation response.
6. Update the Android companion navigation to the final production dashboard section IDs and verify WebView session, downloads, Back behavior, safe areas and touch layouts.
7. Run unit tests, static asset generation, production-route tests and desktop/mobile screenshot comparisons. Do not deploy the dashboard replacement until visual regression and backend behavior pass.

## Release acceptance

- The mandatory design is still recognizably pixel-aligned: same hierarchy, layout, cards, icons, typography, spacing, responsive behavior and interactions.
- No sample names, example addresses, hardcoded counts, invented statuses or local-preview success messages remain in production.
- Each enabled control performs a real authorized action and reports server-confirmed success/failure.
- Unsupported capabilities are clearly marked unavailable and cannot create misleading local-only records.
- Existing authentication, SES SMTP, queueing, D1/R2 records, API credentials and webhooks continue working.
- Android opens the same production dashboard and uses the same backend and account session.
