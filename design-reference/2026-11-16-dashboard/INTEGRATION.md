# Supplied dashboard design — integration staging

Status: **staging reference, source audit, and unmounted API adapter only**. This directory is not a production UI, is not built or served, and must not be mounted as-is. The supplied TSX is preserved losslessly as `App.tsx.deflate.b64` to accommodate source transfer limits; recover it with `node design-reference/2026-11-16-dashboard/unpack.mjs`. The supplied CSS is preserved unchanged. The recovered TSX is an unserved working file. The active dashboard, existing endpoints, Android app, and backend are unchanged. Baseline: `5593c73b4f458dd11b499ddac42dc4d23a8bac55`. This map is based on repository source, not authenticated or production acceptance testing.

The requested destination is the supplied TSX's layout and components, the existing LeadMASTER logo (`public/assets/brand/leadmaster-full.svg`), and access to the remaining existing dashboard features through Settings. Implement that integration before replacing the canonical dashboard. Preserve working functionality and backend behavior; do not invent server capabilities. The current React dashboard is embedded in `src/Mandatory LeadMASTER Dashboard.html` and is mirrored by the asset build; this TSX expects a React/TypeScript and Tailwind build pipeline that the current package does not define. Any new browser asset must retain the server-side dashboard authentication protection, path validation and corresponding route tests.

## Important incompatibilities in the supplied prototype

- The `actions` endpoint and `records.*` collections are not the existing dashboard API. The send handler creates a record and then says it was sent; it does not call the existing mail send endpoint. Never use this as a live send implementation.
- `SAMPLE` and the `DEFAULT_*` arrays contain demonstration email, contacts, scheduled items, templates, notes and rules. Assistant results also contain hard-coded example leads. None are real account data. Do not show them as live records or use them for actions.
- Many mutations update local state and announce success before persistence, including outbox, scheduling, preferences and rules. Show success only after an authoritative response; report ambiguous send outcomes without silently retrying.
- HTML rendering uses `dangerouslySetInnerHTML`. Preserve the existing sanitized, isolated HTML preview implementation (`public/html-preview.js`, `public/html-preview.css` and DOMPurify); untrusted email and input must not execute in the dashboard origin.
- Use the server session and existing same-origin authorization, not a fabricated account ID or browser-stored API key. Preserve the existing login and all backend security behavior. The supplied `LeadMaster` label should be normalized to the product's `LeadMASTER` spelling.

## Source-level mapping for implementation

| Supplied view/control | Existing endpoint or behavior | Integration and limits |
| --- | --- | --- |
| Inbox / Sent / Deleted, counts and message detail | `GET /api/admin/mail?folder=...`, `GET /api/admin/mail/:id` | Map returned fields and load message body on demand; preserve loading, errors, empty states and real server status. Detail reads can mark inbound mail read. |
| Read, archive, delete, restore and permanent delete | `PATCH /api/admin/mail/:id` | Use only supported actions and resource types; keep confirmations and refresh from the server. Permanent deletion applies only to a selected soft-deleted message. |
| Compose / reply / forward | `POST /api/admin/send` | Map real recipient, sender, subject, text and optional HTML fields; preserve validation, copy-recipient restrictions, rollout gates and queue/uncertain outcomes. Never treat queue acceptance as recipient delivery. Keep existing import, groups and HTML preview workflows. |
| Outbox | Sent mailbox and batch status (`GET /api/admin/mail?folder=sent`, `GET /api/admin/send-batches`) | Represent only actual server states; prototype retry/cancel/send-all are local simulations, not a proven mapping. Do not claim these actions work. |
| Templates | `GET/POST /api/admin/templates`, `GET/PUT/DELETE /api/admin/templates/:id` | Map `name`, `subject`, `text`, `html`; list response is summary-only so load details when needed. Category is not part of the API. Confirm destructive operations and surface errors. Requires the existing schema/migration readiness. |
| Assistant | `POST /api/admin/mail/:id/suggest` | Only a per-message reply suggestion exists in the inspected code. The prototype's summary, prioritization, cleanup and canned drafts are not equivalent. |
| Profile / logout | `GET /api/auth/session`, `GET/PATCH /api/account/profile`, `POST /api/auth/logout` | Use authenticated profile and existing response shape; do not claim unsupported profile fields were saved. |
| Additional current features in Settings | Existing dashboard's audience groups/suppression, activity, metrics, API keys, webhooks and other sections | Move or expose working controls under Settings without deleting their existing server calls, workflows or one-time-secret handling. Inspect each actual view before moving it. |
| Automation, scheduled messages, saved drafts, reminders, notes, contact manager, stars/labels and persisted organizer | No equivalent complete capability established by this audit | Show an honest unavailable state or limit to explicitly labeled transient UI behavior. Do not create simulated saved records, scheduled sends or successful actions. |

Templates and audience groups are present in the current source even though parts of the older feature map describe them as unavailable. Verify actual deployment/migration readiness rather than assuming source code is deployed. Review `src/dashboard-feature-map.md`, `docs/DASHBOARD_CONTROL_AUDIT.md`, current source and tests together; no feature-map status is proof of live production behavior.

## Completion gates

1. Add a reproducible TSX/CSS build, retain the supplied layout and existing logo, map actual APIs, and move the remaining working features into Settings. Preserve authenticated dashboard routes and protect every new supporting asset before static lookup.
2. Remove demo data and fake-success actions from the production path; explicitly mark unsupported features unavailable. Preserve existing sanitization, account isolation, mutation protections and safe sending semantics.
3. Keep the canonical dashboard and generated public mirror synchronized with `npm run build:assets`; add regression tests for actual endpoint requests, failures, destructive actions, authentication and tenant isolation. Run `npm test` and inspect desktop/mobile screenshots.
4. Validate the shared Android WebView: navigation mapping, Back, auth/session, file chooser, downloads, external links, keyboard and accessibility. Update and build Android if required, and separately perform device acceptance.
5. Test with an authorized account in a safe environment, review the diff and rollback plan, then deploy only after all gates pass. No production or Android acceptance test has been performed in this staging change.

## Staged API adapter (not production-wired)

`dashboard-api.mjs` covers existing session, profile, mailbox, message actions, reply suggestion, sending, batch progress, templates, groups, suppressions, activity, notifications, API keys and webhooks with same-origin requests. It preserves server responses, does not retry writes and marks uncertain outcomes. Its tests use mock responses; they do not prove backend integration, authentication, security, delivery, or UI behavior. It is not connected to the TSX and is not in the asset bundle. The map above remains incomplete for all visual controls and all current dashboard workflows.

Android review: the current companion loads the shared dashboard in a WebView, maintains cookies, handles file selection, same-origin downloads and external links, and uses WebView history for Back. The local environment does not have Gradle or a configured Android SDK. The GitHub workflow builds a debug APK and conditionally a signed release; neither was run for this staging update. A new WebView dashboard still needs desktop/mobile and Android device acceptance.

`dashboard-model.mjs` adds staging-only mappings of mailbox list rows, message details and template summaries/details. The mappings do not fabricate category, message snippet, attachment metadata, or delivery status. Model tests exercise representative response shapes, not an authenticated end-to-end flow. The TSX still needs to consume the model and adapter; none of these modules are present in the deployed UI.
