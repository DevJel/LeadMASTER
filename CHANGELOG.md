## 2026-11-17 — Persistent dashboard shell and non-blocking content loading

- Kept the shared dashboard header, navigation, profile controls and scroll frame mounted across tab changes; only the active content region changes.
- Reused the last successful workspace snapshot when returning to tabs, avoiding unnecessary full-workspace refetches.
- Replaced the null loading view with an active-view skeleton for the first snapshot. Manual refreshes keep prior content visible; failures show a retry notice instead of replacing the content.
- Added a shared, subtle blurred loading veil with an accessible dismiss control. Dismissing it does not cancel requests; it unmounts automatically when the request completes.
- Aligned utility pages with the same overlay component. Updated synthetic browser and source regression tests. No backend or native Android code changed; production deployment remains unverified.

## 2026-11-17 — Gravatar avatar integration

- Updated the Data Privacy Notice to explain Gravatar's hash-based image requests and the standard connection metadata the image provider may receive; privacy/legal review is required before production release.

- Added a shared SHA-256 Gravatar helper and resilient avatar component. Email addresses are normalized before hashing and never included in image URLs.
- Replaced email identity glyphs with Gravatar avatars where available while retaining existing personal/organization icon fallbacks.
- Added Gravatar avatars to saved Contacts, with locally generated initials when no avatar is available.
- Kept the integration API-key-free and database-free: no migration, extra D1 reads, polling, or authentication/OTP changes.
- Added unit tests for the documented hash, URL construction, normalization and invalid email handling.
- Android uses the same responsive dashboard in its authenticated WebView; no native-only behavior changed.
- Validation/build/deployment status: pending CI and production release checks.

## 2026-11-16 — Unified viewport loading and sending overlays (production deployed)

- Consolidated initial workspace loading, per-tab loading, refresh, and busy-action feedback into one fixed, viewport-centered overlay with a blurred backdrop and dismiss control.
- Removed the in-panel loading skeleton and inline refresh spinner/status banner so loading UI no longer appears inside dashboard panels. Dismissing the overlay hides only the visual layer; the underlying request continues.
- Reused the existing truthful sending-stage component in the same overlay. Unknown send outcomes are labelled as uncertain, never as delivered; transient status clears after the request lifecycle without changing server state.
- Responsive viewport positioning is shared by desktop, mobile browsers and the Android WebView. No backend, API, authentication, database, or native Android behavior changed.
- Added regression checks for overlay placement, dismissal, panel-loader removal and truthful send outcomes. Message-detail loading and standalone Notes, Contacts, Calendar, Currency Conversion, AI email utility, retained Inbox and SMTP settings loading/saving now use the same centered, dismissible overlay treatment. CI, generated asset build, authenticated browser/device checks and production deployment remain pending.

## 2026-11-16 — Premium inbox and navigation refinement (staged; not deployed)

- Removed the Primary, Promotions, Social, Updates and Forums category strip and its category-only inbox filtering; the inbox now presents one unified message list.
- Rebuilt the workspace header with the transparent full LeadMASTER logo at top left, a centered search field and right-aligned utility actions. Removed the header profile control and duplicate Settings shortcut.
- Moved Profile & Settings to the bottom of the sidebar, removed Settings from the main navigation list, and added accessible expand/collapse controls. Mobile navigation opens from a bottom-edge control.
- Updated local screenshot automation and regression tests. The dashboard remains the shared responsive React surface used by Android WebView; no native Android code or backend API behavior changed.
- Source change only until CI, generated assets, authenticated browser checks and the production Worker deployment are verified.

## 2026-11-16 — Documentation screenshot atlas (not deployed)

- Captured watermarked local desktop/mobile UI previews for the public tabs, Help Center, login/code layouts, workspace views, inbox categories and six utilities. The code view is static markup only; no human challenge, OTP or real account is used.
- Added a screenshot gallery, capture instructions, monochrome attributed Simple Icons stack logos and Mermaid diagrams for the Android shell, screenshot pipeline and historical handoff. Archived project README copies remain unchanged.
- Documentation and local capture tooling only: no product UI, API, backend, authentication, schema, assets served to customers or Android behavior changed. CI artifacts are local previews; production deployment and Android device checks remain separate.

## 2026-11-16 — Daily report validation repair (not deployed)

- Corrected report sender identity and the coordinator message ID while preserving the existing idempotency key.
- Fixed a sender health check that rejected valid addresses; added reporter-to-coordinator-to-simulated-transport tests.
- This does not prove live delivery or resolve missing read-only account-audit and repository monitoring access. Unknown past sends must be reconciled, not blindly repeated.
- Backend-only change; the shared web dashboard and Android WebView are unaffected. No production deployment or live report was performed.

## 2026-11-16 — Safer message viewing and retry safeguards (not deployed)

- Sent message details expose their stored HTML alternative, displayed through a sanitized opaque-origin sandbox that blocks scripts, links and remote content. Incoming HTML extraction is not implemented.
- Replaced a fictional attachment card with the existing authenticated original-message download, and added message-load retry handling.
- Outbox distinguishes unknown outcomes; removed unsafe bulk/resend controls that could duplicate active sends or lose original fields. Complete retry/edit/preview/delete flows are not yet implemented.
- Added a proposed thread and attachment design; no schema migration, thread model, attachment extraction/sending, or reply-header transport was deployed or enabled.
- Web UI is shared by Android WebView; no native code changed. Android device/download acceptance and authenticated production verification remain outstanding.

## 2026-11-16 — Customer product and developer guides (not deployed)

- Added Help Center links to product features, email delivery, the developer API, webhooks and MCP availability.
- Replaced internal operations material in public guides with customer support guidance and kept protocol limitations and security warnings visible.
- Documented external SMTP, automated scheduling and MCP as unavailable; no new integration or sending behavior was enabled.
- Updated API examples to use the account-specific endpoint returned when creating a key. Live delivery, webhook safety and production deployment remain separate verification steps.

## 2026-11-16 — Truthful dashboard loading states (not deployed)

- Show the existing loading view during real workspace fetches and show a retryable error instead of an empty workspace when loading fails.
- Removed the duplicate refresh request and retained failure reporting.
- Added source and synthetic local browser regression checks for loading, failure, retry, empty and refresh states.
- Successful refreshes no longer display a confirmation notice; failures remain visible. The header uses the existing favicon without a wordmark.
- The shared web layout and Android WebView use the same dashboard; no native Android source, API, authentication or data schema changes. Device and authenticated production checks remain outstanding.

## 2026-11-16 — Dashboard validation CI repair (not deployed)

- Repaired the staged dashboard bundle validation script after a malformed recent edit, retaining JavaScript, component CSS and shared sending-indicator stylesheet checks.
- Added a regression test that runs the validator and documented the asset-build prerequisite for local checks.
- No runtime, API, data, authentication, dashboard UI or Android behavior changed; Android shares the unchanged web workspace.
- Local validation only; PR checks and production deployment are separate.
## 2026-11-16 — Feature architecture documentation and dashboard CI corrections (not deployed)

- Added a central feature index and 14 feature guides under `docs/features/`, with Mermaid flows, source references, API/data connections, authorization boundaries and explicit availability limits.
- Updated README and maintainer handover to point to the feature guide set and extensionless browser URL contract.
- Rebuilt the dashboard feature map around the current React dashboard, UtilityApps module, account-scoped record API and real production capability boundaries.
- Removed an unused contact-filter calculation left over after the old right-hand panel was removed; it referenced an undefined variable during dashboard initialization.
- Updated the dashboard bundle checker to validate SendingIndicator styles in the shared dashboard stylesheet instead of expecting a nonexistent component-local CSS output.
- Automated tests, browser screenshots, static asset verification and production deployment remain pending for this change.

## 2026-11-16 — Clean extensionless page URLs (not deployed)

- Added canonical browser routes for the landing page, login, dashboard, Help Center, documentation, privacy, terms and developer API-key console while continuing to serve the existing HTML assets internally.
- Added permanent redirects from legacy `.html` page URLs to extensionless paths, preserving query strings and dashboard app deep links.
- Kept dashboard pages, dashboard JavaScript/CSS bundles and developer API-key pages behind the existing authenticated session check.
- Fixed the dashboard asset route classification so the dashboard's own JavaScript/CSS bundles are not mistaken for invalid dashboard sub-pages.
- Updated landing, login, Help Center and utility links to use clean paths; no API endpoints, data models, email workflows or authentication semantics changed.
- Corrected pre-existing Notes JSX and utility component import paths that prevented the dashboard asset build from completing.
- Added route regression tests for clean paths, legacy redirects, protected assets, casing and trailing slashes.
- Asset rebuild, complete CI, production deployment and live browser verification are pending.

## 2026-11-16 — Supplied dashboard integration staging (not deployed)

- Preserved the supplied TSX and CSS as unserved design references and documented source-level API mapping and integration blockers.
- Added a non-served, unmounted API adapter and mailbox/template response mappings with mocked contract tests; the production dashboard is not wired to them.
- Added a draft persistence module and migration in the branch with revision checks and authorization tests; it is not routed, wired to the UI, or deployed.
- A pre-existing undefined argument in the account email route was reproduced locally; no fix has been committed or deployed.
- Added unmounted validation and encryption helpers for the requested external SMTP setup; connection, UI, queue integration, LeadMASTER-only monitoring and deployment remain unimplemented.
- No active UI, authentication, generated asset, or Android runtime change. Android uses the existing shared dashboard; device acceptance is not applicable to this staging-only change.
- This does not implement the redesign. Account-backed wiring, safe unavailable states, accessible responsive testing, Android parity review, authenticated acceptance and deployment remain pending.

## 2026-11-11 — Mailbox deletion controls (feature branch; not deployed)

- Added a Deleted mailbox view alongside Sending, Receiving and Suppressions, using the existing authenticated mailbox list endpoint.
- Added explicit confirmation before moving a message to Deleted; refreshes mailbox data from the server after success or uncertain outcomes.
- Added Restore and separately confirmed Permanently delete actions in the Deleted view, using the existing Worker actions and retry-safe inbound cleanup.
- Permanent deletion remains per-message; it does not clear D1 wholesale or delete send queues, delivery-event history, suppression entries, API keys, webhook records or activity logs.
- Suppression entries remain protected from ordinary deletion because removing a suppression permits future sending. API keys and webhooks remain revoke-only; activity is retained.
- Canonical dashboard and `public/dashboard.html` were synchronized byte-for-byte. Tests, asset rebuild, browser/Android acceptance and production deployment remain pending.

# Changelog

## 2026-11-11 — Recipient-level sending and status safety (not deployed)

- Split dashboard batch processing into individual SMTP submissions with recipient-specific durable claims and correlation IDs; suppression and outcomes are per recipient. New multi-To requests with CC/BCC are rejected; legacy batches include copies only on the first original To message and omit them if that recipient is suppressed.
- Preserve uncertain partial SMTP outcomes and emit correlation tags for legacy chunked messages. Dead-letter processing distinguishes unclaimed failures from claimed unknown outcomes.
- Enforce a conservative recipient-count limit of 10 per second for submissions using the shared coordinator, including CC/BCC; unrelated applications remain outside its control.
- No UI redesign, database migration, credentials, deployed settings, or Android source changes. Android uses the shared web flow; real-device testing and authorized live delivery acceptance are pending. Existing legacy batch claims must be reconciled before rollout, never replayed automatically.


## 2026-11-11 — Android engineering documentation and release guide (v1.6.0)

- Replaced the Android README with a source-aligned engineering guide covering architecture, feature inventory, notification behavior, authentication persistence, WebView security, permissions, build/CI, artifact retrieval, release signing, parity requirements, device acceptance and troubleshooting.
- Corrected the root README to describe Android as a thin host for the canonical responsive dashboard, removing stale claims about a duplicated native navigation structure.
- Added explicit current app metadata from Gradle: application ID `pro.leadmaster.app`, version `1.6.0`, version code `7`, minimum API 26, compile/target API 35 and Java/Kotlin 17.
- Documented that the Actions debug APK artifact is retained for 90 days and is not a permanent public GitHub Release or a production-key-signed distribution.
- Clarified that native inbox/activity notifications use foreground polling and are not guaranteed push notifications while the app is closed.
- Documentation-only change; no Android runtime, authentication, Worker, API, database or production deployment behavior changed.

# Changelog

## 2026-11-10 — Persistent Android sign-in (v1.5.0)

- Extended the server-side session and matching Secure, HttpOnly, SameSite=Strict cookie lifetime to 180 days, renewed on each successful session restore, so the user remains signed in across app closure and continued use.
- Preserved explicit sign-out: the existing logout action revokes the server-side session and clears the cookie.
- Android now flushes WebView cookies after page load and during pause, stop and destroy so the persistent session survives app process closure.
- Added regression coverage for sliding session renewal and explicit logout revocation.
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

### Sign-in verification resilience (unreleased)
- Allow verification of an already-delivered code and existing-session access when unrelated mail or login-check settings are absent, while retaining required authentication checks.
- Keep an OTP claimed when a fallback session write has an uncertain outcome; do not reset incorrect-attempt counts.
- Add synthetic full-path code generation, email validation and verification, plus negative and fallback regression tests. Live sign-in and production rollout remain unverified.

### Foreground mail sounds (unreleased)
- Added opt-in, distinct foreground audio for received mail, accepted sends and confirmed deletions in the shared web/Android workspace.
- Suppressed duplicate Android foreground notification-card audio; no background push or inbox-delivery guarantee is implied.

### OTP verification read resilience (unreleased)
- Bounded retries for temporary read-only verification dependencies, with fail-closed behavior and non-sensitive diagnostic categories.
- Retained single-use challenge, attempt limits and non-retry rules for authentication writes. A real production failure and deployment remain unverified.
