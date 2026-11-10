# Changelog

## 2026-11-10 — Persistent Android sign-in (v1.5.0)

- Extended the server-side session and matching Secure, HttpOnly, SameSite=Strict cookie lifetime to 180 days so the user remains signed in after closing and reopening the Android app.
- Preserved explicit sign-out: the existing logout action revokes the server-side session and clears the cookie.
- Android now flushes WebView cookies after page load and during pause, stop and destroy so the persistent session survives app process closure.
- No credentials are copied into local storage or SharedPreferences; account recognition continues through the existing authenticated server session.
- No email, account data, database schema or business workflow changes.
- Automated build and auth regression checks pending.


## 2026-11-10 — Android responsive dashboard parity (v1.4.0)

- Removed the extra native bottom navigation bar and desktop Navigation Rail so Android displays the canonical LeadMASTER dashboard's own responsive navigation and components without duplicate chrome.
- Removed the native-app CSS flag injection that hid the dashboard's mobile navigation.
- Made the authenticated dashboard the single visual source for mobile and larger Android screens, preserving its layout, theme, cards, forms, spacing and interactions.
- Kept Android system-bar icon contrast synchronized with the dashboard's light/dark theme.
- Configured WebView to honor the responsive viewport without desktop overview scaling or forced text zoom.
- Preserved the restricted HTTPS origin, authenticated cookie session, multi-file picker, downloads, external links and native notifications.
- No backend, API, database, authentication or email business logic was changed.
- Android version bumped to 1.4.0 (versionCode 5); automated build and device-level acceptance are pending.

## 2026-11-09 — Restore continuous product motion and primary administrator sign-in

- Restored looping animations for the landing-page Product Moments concepts, including the message reveal, workflow progress, step highlights and activity bars; reduced-motion preferences remain respected.
- Restored click-through behavior on the animated LeadMASTER halftone wordmark so selecting the wordmark opens the administrator login page.
- Removed IP- and email-based request throttles from the single configured primary administrator login and OTP verification flow. Turnstile, password verification, OTP expiry, single-use and the five-incorrect-attempt cap remain in place.
- Updated authentication documentation, regression tests and the generated static asset bundle.

## 2026-11-09 — Dashboard account context and branded OTP sender

- Replaced the misleading unavailable-workspace message with an authenticated account summary showing the current account ID and API base URL.
- Added a direct route from the dashboard overview to the account's developer API-key console.
- Clarified that email API and webhook integrations use account-scoped API keys while mailbox, campaigns, audiences, templates and analytics remain incomplete dashboard modules.
- Added safe sender display-name support to the SMTP transport and set the human sign-in OTP sender to **LeadMaster** without changing the verified sender address or SMTP envelope sender.
- Added regression coverage for the visible From header and preserved SMTP envelope sender.

# Changelog

## 2026-11-09 — Documentation consolidation and maintainer handover

- Integrated product, authentication, developer API, webhook, queue, MCP and operations documentation into the landing-page Documentation tab.
- Corrected stale landing-page statements that described deployed authentication and API routes as unavailable.
- Added searchable documentation categories and deep-link anchors.
- Redirected legacy `/docs.html` and `/mcp.html` destinations to landing-page documentation.
- Added root `AGENTS.md` with cross-layer change rules for UI, API, backend, tests, public docs, engineering docs, README, handover and generated assets.
- Added root `HANDOVER.md` with architecture, routes, security boundaries, operations and acceptance-test checklist.
- Updated README and authentication notes to reflect the deployed implementation and known incomplete features.
- Added static asset build tooling; deployment and verification status must be appended after the bundle is rebuilt and the Worker is deployed.

Unit tests do not prove live Turnstile, SES inbox delivery or webhook callback receipt.


## 2026-11-09 — Production deployment and verification

- Bundled the canonical landing page and documentation assets into the production Worker; root `/` now resolves to `/index.html` instead of depending on the preview fallback.
- Deployed Worker version 113 (version ID `74522785-4f5f-43be-bd53-c70c4d8092bf`) at 100% traffic; deployment ID `8a552314-390a-42e2-b5be-89105ef86c69`.
- Inspected the uploaded Worker bundle and confirmed the root mapping, integrated documentation markup, updated production capability copy, docs search logic and legacy documentation redirect assets are included.
- Live browser route inspection was unavailable in this run; Cloudflare deployment/version state was verified through the account API.
- Automated `npm test` was not run. Real administrator login, SES inbox delivery and webhook callback acceptance remain unverified.

- Added direct links from the API, production-authentication and queue engineering references to the single public landing-page documentation hub.


## 2026-11-09 — AI-agent discovery and public-surface hardening

- Added root and public `llms.txt` with canonical product overview, supported features, API scopes, copy-ready cURL and Node.js examples, webhook signing requirements, agent workflow, feature limits and explicit MCP status.
- Added `robots.txt` crawler rules to permit public documentation while discouraging indexing of authentication, dashboard, API and private application routes. Robots rules are not access controls.
- Added landing-page AI-agent integration section, machine-readable guide links and agent-specific REST API instructions.
- Explicitly prohibited agents from automating human sign-in, using security challenges, requesting OTPs or attempting challenge bypasses.
- Reserved `/mcp` with an explicit 404 response because MCP is not mounted in production; the REST API remains the supported agent interface.
- Removed underlying infrastructure/provider details from the public landing and login copy; refreshed privacy and terms language to describe service providers generically. Legal processor disclosures still require operator review for applicable law and actual data flows.
- Added root agent rules and handover requirements for vendor-neutral UI, least-privilege agent access, truthful capability claims and synchronized documentation.
- Added `llms.txt` and `robots.txt` to the generated production asset map.
- Production Worker version `5ce0609c-ecbb-43f5-9a0d-4c4638511e03` (version 133) deployed at 100%; external HTTP smoke checks are blocked by the connected tool's outbound-domain policy, and the unit test suite was not run in this session.


## 2026-11-09 — Account-owned integrations and developer handover (feature branch)

- Added account and membership tables, account ownership backfill for existing developer keys, email requests and webhooks.
- Added authenticated account resolution and account-specific REST routes for account info, email submission/status and webhook management/delivery history.
- Bound API key management to the signed-in account; returned account-specific endpoint URLs when creating keys.
- Enforced account/key ownership in email and webhook authorization/dispatch paths and rejected legacy unscoped API routes.
- Added cross-account negative tests for email, account metadata, webhook access and API-key listing.
- Updated landing Documentation tab, machine-readable agent instructions, API reference, README and handover with account-first access rules and Mermaid flows.
- Not deployed: migration application, full test suite, live account-isolation verification, authenticated end-to-end email/webhook checks and genuine authenticated dashboard screenshots remain release gates.


- Added account endpoint visibility and copy action to the developer API console.
- Added reproducible, watermarked local UI screenshot capture for landing, integrated documentation, login, dashboard tabs and API Keys console. Screenshots are delivered as a CI artifact and are explicitly labeled synthetic.
- Production Worker version `050eacd1-e8e6-4f4b-935e-b202390dcf2c` (version 137) deployed at 100%; external HTTP smoke checks are blocked by the connected tool's outbound-domain policy, and the unit test suite was not run in this session.


## 2026-11-09 — Production account-schema activation

- Applied the account-scoped integration migration to the production D1 database after verifying the existing developer tables and confirming there were no API-key, email-request or webhook records to backfill.
- Created the D1 migration ledger and recorded existing migrations 0002/0003 plus the newly applied 0004 migration to prevent future Wrangler migration runs from replaying already-applied schema changes.
- Verified account, membership, API-key, email-request, webhook and delivery tables are present; confirmed no pre-existing integration rows were lost or left unowned.
- Verified the active Worker remains version 144 at 100% traffic and its production D1/Secrets Store bindings align with repository configuration.
- Verified the configured SES sender identity is verified and sending-enabled; left sender and all existing secrets unchanged.
- No Worker code upload was necessary because the active version already contained the account-scoped routes.
- Remaining acceptance checks: authenticated browser login and Turnstile/OTP, controlled email inbox delivery, webhook callback delivery, account-isolation negative tests and external HTTP smoke tests. Webhook callback URL validation still requires stronger DNS/private-address and redirect protections before full SSRF-resistance can be claimed.


## 2026-11-09 — Android companion navigation and web parity

- Aligned native bottom navigation with live dashboard sections: Overview, Emails, Activity, Sending addresses and Settings.
- Added active-section highlighting and synchronization for hash navigation.
- Improved system Back behavior so nested dashboard sections return to Overview before leaving the workspace.
- Restricted in-app navigation to the exact HTTPS LeadMASTER origin; supported external web, email and telephone links are handed to Android safely.
- Documented the cross-platform parity rule in AGENTS.md, README.md, the Android README and the public agent guide: relevant web changes must be assessed and aligned in Android, while shared business logic remains in the web/server layer.
- Android build and device acceptance are pending the workflow result; no production web backend or account behavior was changed.


## 2026-11-09 — Mandatory dashboard integration (initial production wiring)

- Promoted `src/Mandatory LeadMASTER Dashboard.html` to the canonical dashboard source and synchronized the production `public/dashboard.html` / Worker static asset.
- Preserved the supplied React component tree and embedded visual system while replacing preview account identity and sample activity with authenticated session, profile, mail counts, activity and API-key data.
- Connected email folders to the live mailbox endpoints, message detail/delete actions to the mailbox API, compose to the production sending queue, profile save/logout to authenticated endpoints, and API-key list/create to account-scoped key management.
- Removed sample audience, activity, automation, webhook and campaign records from the initial data collections; unsupported backend features must not be represented as live records.
- Updated the asset build script, tests, agent instructions and Android navigation parity. Full feature coverage for templates, audience/contact CRUD, campaign scheduling, automation workflows, domain verification, engagement analytics and session-based webhook management remains outstanding.


## 2026-11-09 — Mandatory dashboard live feature integration

- Kept the mandatory React dashboard as the canonical visual source and synchronized its public mirror.
- Connected live suppression list and add-suppression action, account-scoped webhook listing/creation/revocation/delivery history, optional least-privilege webhook API-key scope, live accepted-send list and existing sending composer.
- Replaced sample template, audience, inbox, campaign, automation, metrics and domain-verification content with real data or explicit unavailable states.
- Updated Android native navigation to mirror Home, Emails, Audience, Metrics and Profile section IDs.
- Updated dashboard feature map, agent instructions, README, handover, dashboard tests and desktop/mobile screenshot capture workflow.
- LeadMASTER CI and desktop/mobile screenshot capture passed on 2026-11-09 (run 42597803329). The Android debug APK build passed (run 42596263455). Static assets include the canonical dashboard and HTML-preview assets; Cloudflare Worker `leadmaster` deployment `71150f57-564d-48e2-ab24-6fd46b1a4130` has 100% traffic. Authenticated production click-through and real mail delivery smoke tests remain outstanding.


## 2026-11-09 — Mandatory dashboard integration

- Preserved the mandatory React dashboard visual system and synchronized its public mirror.
- Connected suppression list and manual suppression, live accepted-send list, existing send composer, account-scoped webhook management, one-time signing-secret display, and optional least-privilege webhook API-key scope.
- Replaced unsupported sample records and simulated states with live data or clear unavailable states.
- Restored the sanitized HTML preview separately for Emails and Templates.
- Aligned Android native navigation with Home, Emails, Audience, Metrics and Profile.
- Updated feature map, agent rules, tests and desktop/mobile screenshot capture. CI and production browser acceptance remain pending.

## 2026-11-09 — Inbound deletion safety (initial feature branch)

- Claim a soft-deleted inbound row in D1 before deleting its original object; refuse restore while the durable deletion claim is pending. Retry resumes cleanup if object or database deletion failed.
- Refuse permanent deletion of non-deleted sent and developer messages instead of reporting success.
- Migration `0008_inbound_deletion_claim.sql` is required before the Worker code; rehearse in staging and review forward-only rollback before release. At the time of this entry, no migration or deployment had been performed; see the subsequent production status entry.
- Added local unit/failure/race tests. Full suite, Cloudflare runtime, production records and Android device behavior remain unverified. No UI, public API contract, or Android source was changed; Android shares the same web API behavior and needs a deletion/restore smoke test.
- Partial queue failure, full-screen compose, confirmation UX, contacts, scheduling and other finalization requirements remain open.

## 2026-11-09 — Suppression validation and dashboard audit (feature branch)

- Fix over-escaped suppression email validation and add unit tests. No schema or dashboard visual change; Android shares the same backend and should be included in acceptance testing.
- Document initial control-to-endpoint audit, including UI-only filters/export and missing delete confirmation / reload. The full audit and requested feature implementation remain incomplete.
- Not deployed. GitHub CI, staging and authenticated acceptance pending.

## 2026-11-09 — Inbound deletion production status

- The deletion-claim code was observed in the live Worker, and migration `0008_inbound_deletion_claim.sql` was applied and verified in D1. The exact deployed Git commit was not independently verified.
- No live deletion or restoration was performed; staging rehearsal and end-to-end acceptance remain outstanding. A D1 time-travel rollback affects the whole database and does not restore R2 objects.
