# Mandatory LeadMASTER Dashboard — production integration map

**Canonical UI:** `src/Mandatory LeadMASTER Dashboard.html`  
**Production mirror:** `public/dashboard.html`  
**Authenticated route:** `/dashboard.html`

## Visual contract
The mandatory HTML is the authoritative React dashboard. Preserve its component tree, embedded styling, layout, typography, spacing, icons, responsive breakpoints, side navigation, mobile bottom navigation, drawers, cards, tables and interactions. API work must update data and behavior without redesigning the interface. The public mirror must remain byte-for-byte identical; `npm run build:assets` synchronizes it and regenerates `src/static-assets.mjs`.

## Live integrations
| Feature | API | Current behavior |
|---|---|---|
| Account identity | `GET /api/auth/session`, `GET /api/account/profile` | Authenticated account and owner profile. |
| Overview | `GET /api/admin/mail?folder=counts`, `GET /api/admin/activity` | Live mailbox/queue counts and workspace activity. |
| Emails | `GET /api/admin/mail?folder=...`, `GET /api/admin/mail/:id`, `PATCH /api/admin/mail/:id`, `POST /api/admin/send` | Inbound/sent/queued states, message detail, mailbox actions and send composer. |
| Reply assistance | `POST /api/admin/mail/:id/suggest` | Existing mailbox reply suggestion flow. |
| Audience / suppression | `GET/POST /api/admin/unsubscribes` | Real do-not-contact list and manual suppression. Not a contact manager. |
| Inboxes | Dedicated inbound mailbox | One account mailbox; no inbox provisioning API. |
| Broadcasts | `GET /api/admin/mail?folder=sent`, `POST /api/admin/send` | Accepted sends plus existing immediate send queue (up to 500 recipients). |
| Metrics | `GET /api/admin/mail?folder=counts` | Accepted sends, inbox, queued, unsuccessful, bounce/complaint counts only. |
| Activity | `GET /api/admin/activity` | Account activity; not open/click tracking. |
| API keys | `GET/POST /api/developer/keys`, `DELETE /api/developer/keys/:id` | Account-scoped keys; full key shown once. Optional `webhook:manage` scope is explicit and off by default. |
| Webhooks | `GET/POST /api/admin/webhooks`, `DELETE /api/admin/webhooks/:id`, `GET /api/admin/webhooks/:id/deliveries` | Account-scoped list/create/revoke/history. Creation requires an active account API key with `webhook:manage`; signing secret shown once. Events: `email.accepted`, `email.failed`, `email.unknown`. |
| Settings | `GET/PATCH /api/account/profile` | Owner display name editable; account email, workspace and device timezone read-only. |
| Session | `POST /api/auth/logout` | Existing server-side logout. |
| HTML preview | `public/html-preview.js`, `public/html-preview.css`, DOMPurify | Separate email and template HTML preview routes. Sanitized content is rendered in a sandboxed iframe with a restrictive CSP; preview content is not sent or persisted. |

## Not available as production features
Keep these navigation entries visible, but do not invent rows, local-success toasts or statuses:
- Saved template CRUD; system OTP templates are not a customer template library.
- Contacts, marketing lists and segments; only suppression data exists.
- Multiple inbox provisioning and forwarding configuration.
- Saved drafts and scheduled campaigns; current send endpoint queues immediate sends only.
- Workflow automation triggers, scheduler and execution engine.
- Opens, clicks, attribution and engagement time-series.
- DNS/DKIM/SPF verification; sender allowlist is not a DNS verification service.
- Team management and account deletion.
- Persistent onboarding workflow state.

## Security and data rules
1. Use authenticated LeadMASTER session and account-scoped server authorization; never client-filter global records.
2. Cookie-authenticated mutations retain same-origin checks and server validation.
3. Never expose key hashes, full API keys after creation, webhook secrets after initial reveal, or another account's resources.
4. Queue acceptance is not recipient delivery. Display the actual backend state.
5. Preserve login, Turnstile, email OTP and session controls.
6. Do not enable MCP; production integrations use the documented account-scoped REST API.

## Android parity
Android shares the authenticated dashboard and backend. Native bottom navigation mirrors mandatory mobile section IDs: `home`, `emails`, `audience`, `metrics`, `profile`. Other modules remain in the dashboard drawer. Back returns to Home before leaving the workspace. Update and build Android in the same branch when section IDs, connected actions or security behavior change.

## Release checks
Run `npm test`, `npm run build:assets`, syntax checks for worker and developer modules, `node scripts/capture-screenshots.mjs`, and Android APK build when Android changes. Review desktop/mobile screenshots and perform authenticated production smoke tests for mailbox, send queue, suppression, API keys and webhooks before claiming end-to-end readiness. Never deploy while tests or visual checks fail.


## Header profile control

The dashboard header must contain only a compact profile SVG icon aligned at the far right (Cloudflare-style). Do not repeat the user's name/avatar or a Profile text tab in the header. The actual Profile page belongs only to the dashboard navigation (mobile bottom tab and desktop sidebar). The icon may expose the signed-in email and Log out; do not add a second profile-page destination. The authenticated login flow already redirects to `/dashboard.html`, which serves the mandatory dashboard; `/dashboard` redirects to that same canonical route. Replace any legacy dashboard rather than maintaining parallel dashboard implementations.


## Dashboard authentication is mandatory

Every dashboard document and supporting bundle must be protected by a server-validated `lm_session` cookie using `sessionFor()` before static asset lookup or upstream proxying. Normalize and decode URL paths before checking access; reject malformed paths, case variants, encoded separators and trailing-slash aliases. Unauthenticated dashboard requests must redirect to `/login.html`; never rely on React/client-side checks or hidden navigation. Keep the dashboard's HTML, JS, CSS, preview scripts and DOMPurify asset protected. Add regression tests whenever routes or assets change. Never proxy an unknown dashboard-like path to the preview upstream.


## Dashboard authentication is mandatory

Every dashboard document and supporting bundle must be protected by a server-validated `lm_session` cookie using `sessionFor()` before static asset lookup or upstream proxying. Normalize and decode URL paths before checking access; reject malformed paths, case variants, encoded separators and trailing-slash aliases. Unauthenticated dashboard requests must redirect to `/login.html`; never rely on React/client-side checks or hidden navigation. Keep the dashboard's HTML, JS, CSS, preview scripts and DOMPurify asset protected. Add regression tests whenever routes or assets change. Never proxy an unknown dashboard-like path to the preview upstream.
