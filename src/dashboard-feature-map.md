# LeadMASTER dashboard and feature integration map

**Canonical dashboard component:** `required-componets-design/App.tsx`  
**Utility application component:** `required-componets-design/UtilityApps.tsx`  
**Dashboard HTML shell:** `src/Mandatory LeadMASTER Dashboard.html`  
**Production static mirror:** `public/dashboard.html`  
**Canonical browser route:** `/dashboard`  
**Internal asset route:** `/dashboard.html` (served by the Worker; old public URL redirects)

## Feature architecture index

See [`docs/FEATURES.md`](../docs/FEATURES.md) for the complete implementation/status matrix and the Mermaid guides under [`docs/features/`](../docs/features/). Those documents are the primary feature-level description and must be updated alongside code.

## Live or implemented dashboard connections

| Feature | API / source | Behavior and boundary |
|---|---|---|
| Account identity | `GET /api/auth/session`, `GET /api/account/profile` | Uses the validated administrator session and current account. |
| Mailbox counts and views | `GET /api/admin/mail?folder=counts`, `GET /api/admin/mail?folder=...` | Loads authoritative mailbox and sending state. |
| Message detail and actions | `GET /api/admin/mail/:id`, `PATCH /api/admin/mail/:id` | Reads actual message body; archive, soft-delete, restore and confirmed permanent delete are server actions. |
| Send | `POST /api/admin/send` | Immediate queue submission. Queue acceptance is not delivery confirmation. |
| Reply suggestion | `POST /api/admin/mail/:id/suggest` | User-triggered draft; human review and send confirmation required. |
| Suppression | `GET/POST /api/admin/unsubscribes` | Do-not-contact records; not an ordinary contacts manager. |
| Activity / notifications | `GET /api/admin/activity`, notification routes | Account audit/activity and open-dashboard notifications. No background push when closed. |
| API keys | `GET/POST /api/developer/keys`, `DELETE /api/developer/keys/:id` | Account-owned keys, scoped and revealed once. |
| Webhooks | `/api/v1/accounts/{account_id}/webhooks` and admin console routes | Account/key-owned endpoint, one-time secret and delivery attempt history. |
| Settings | `GET/PATCH /api/account/profile` | Editable owner display name; protected account identity. |
| Workspace utilities | `POST /api/workspace/actions` | Account-scoped `records.list/create/replace/delete` actions with a collection allowlist. |
| HTML preview | `public/html-preview.js`, `public/html-preview.css`, DOMPurify | Browser-local sanitized preview; not sending or persistence. |

## Utility modules

The Apps launcher exposes Notes, Contacts, Calendar, Calculator, Currency Conversion and Email HTML Playground. Notes, Contacts and Calendar use workspace record collections. Calculator and HTML Playground are local tools. Currency Conversion requires a real quote source and must not fabricate or silently reuse an expired rate.

## Explicitly not production capabilities

- Full saved-template edit/delete lifecycle.
- Contact segmentation/marketing campaign management.
- Scheduled campaigns or calendar-triggered sends.
- General workflow automation triggers/execution engine.
- Opens, clicks or engagement analytics.
- Multiple inbox provisioning and forwarding editor.
- Team membership, self-service signup or organization switching.
- Public production MCP endpoint or MCP send tool.

## Mailbox deletion safety

- Move to Deleted is reversible soft-delete.
- Restore is available only while a message remains in Deleted and no permanent cleanup claim blocks restoration.
- Permanent deletion requires explicit confirmation and affects only the selected record/object.
- Do not clear D1, queues, send-batch records, delivery-event history, suppression, API keys, webhooks or activity/audit data through mailbox controls.
- Do not provide ordinary delete controls for do-not-contact, API keys, webhooks or audit records. Use the relevant revoke/retention workflow.

## Desktop/mobile shell

Desktop uses a fixed application shell and a scrollable main content area; mobile adapts the navigation and content. The responsive React dashboard is also the Android WebView UI. Keep backend APIs and account session logic shared; do not duplicate backend functionality in the native wrapper.

## Loading and error handling

Workspace fetches show the existing loading indicator until a complete server snapshot is available. A failed foreground fetch shows a retryable error instead of an empty-state claim; retry uses one fetch cycle. Silent background refresh retains prior data and reports explicit refresh errors. Browser regression uses synthetic local data; authenticated acceptance remains separate.

## Security and release checks

1. Validate the current administrator session before serving the dashboard HTML or protected bundles.
2. Use the exact account context returned by the authenticated server session.
3. Do not use local state as proof of saved state; reload authoritative API data after mutations and uncertain outcomes.
4. Preserve same-origin checks, bounded inputs and error mapping.
5. Run `npm test`, `npm run build:assets`, `npm run check:dashboard`, syntax checks and screenshot capture.
6. Inspect desktop and mobile screenshots, then perform authenticated browser smoke tests before deployment.
7. Update `docs/FEATURES.md`, the relevant feature guide, `README.md`, `HANDOVER.md` and `CHANGELOG.md` in the same change where affected.
