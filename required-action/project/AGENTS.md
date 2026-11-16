# LeadMASTER — AI agent and contributor rules

These instructions apply to every AI coding agent, automation, developer and contributor working on LeadMASTER.

## Read before changing anything

1. Read `HANDOVER.md` and `README.md`.
2. Read the relevant `docs/*.md`, source modules, migrations and tests.
3. Inspect the current branch and actual implementation. Do not rely on old chat summaries or assume a planned feature exists.
4. Confirm whether the requested action is for the user's current LeadMASTER account or a different explicitly selected account.
5. Do not access operator credentials, internal platform consoles, internal service accounts or another user's account.

## Product identity and confidentiality

- Refer to the product as **LeadMASTER** in all user-facing UI, messages, docs, API errors, generated examples and status information.
- Never expose internal hosting, infrastructure, deployment, database, email transport, SMTP, provider, secret-storage, worker, operator-account or vendor names/status in the product UI or customer-facing responses.
- Do not expose internal bindings, account IDs from other users, secret names, environment variables, deployment identifiers, service URLs or provider-console details in public UI.
- Describe only LeadMASTER's own features, account information and observable request outcomes.
- Never say a provider is healthy, down, verified or connected as though it were a LeadMASTER product feature. Report LeadMASTER-level status only.
- Legal privacy notices must still accurately identify processors or recipients if applicable law requires it. Do not remove legally required disclosures; request privacy review.
- Keep internal implementation details in private operational configuration. Do not copy them into public docs, user messages, dashboard labels or API response text.

## Account-first context and strict tenant isolation

- Every user-facing action must use the current user's authenticated LeadMASTER account context and current saved account information.
- Obtain account IDs and generated API/webhook endpoint URLs only from that user's authenticated workspace, account console or API-key creation response. Never guess, enumerate, derive or substitute IDs.
- Never use platform-wide, operator, developer, shared, test or another user's credentials or saved data.
- Never access internal platform data as a fallback when the user's account context is missing. Stop and ask the user to select or connect the correct LeadMASTER account.
- Every API key and integration resource must have an explicit account owner.
- Include account ownership in every database read, update, delete, list and dispatch predicate for tenant-owned resources.
- Validate both the account ID in the route and the account/key/resource ownership on the server for every protected request.
- Never fetch resources globally and filter in the browser. Never rely on an unguessable ID alone as authorization.
- Email requests, webhook registrations, signing secrets, delivery history and future MCP resources must remain inside the creating account and permitted key scope.
- Cross-account attempts must fail without revealing whether another account's resource exists.
- Add negative tests for account A attempting to read, send, list, mutate, revoke or receive events belonging to account B.
- The current authentication rollout supports one configured administrator identity. Do not advertise self-service signup, team invitations, organization switching or multi-member roles as live.

## Agent access and human login security

- AI agents authenticate only through the documented LeadMASTER account-scoped REST API using an account-bound API key with minimum scopes.
- Human login security verification, password and email OTP are not agent authentication.
- Never open, automate, scrape, solve, bypass, replay or request tokens from the human sign-in challenge.
- Never ask users for passwords, OTPs, browser cookies, challenge tokens, API keys or webhook signing secrets in chat.
- Keep credentials in the user's own server-side secret manager. Never place them in browser JavaScript, mobile bundles, public source control, logs or screenshots.
- Never use a browser session or human administrator credential as a substitute for an API key.
- Obtain explicit user approval before sending an email. Confirm the recipient, purpose and content.

## API and webhook rules

- Use only the exact account-specific endpoint returned by the current user's LeadMASTER account.
- Require a valid Bearer key and the minimum required scope.
- Use stable idempotency keys for side effects. Reconcile uncertain outcomes before retrying.
- Do not claim `accepted` means inbox delivery.
- Webhook secrets are shown once. Store them only in the user's callback server's secure configuration.
- Verify webhook HMAC against the exact raw body, enforce timestamp age, compare in constant time and deduplicate event IDs.
- Ensure webhook dispatch filters by both account ownership and creating key.
- Never forward one account's event, recipient, subject or delivery history to another account's callback.
- Callback URL validation must be treated as security-sensitive. Do not claim full SSRF protection until DNS rebinding and private-address resolution are defended.

## MCP policy

- MCP is not available as a production service. Do not invent a URL, tell users to connect, or claim production tools exist.
- The supported agent integration is the account-scoped REST API.
- Any future MCP implementation must derive account context from its authenticated principal, never a caller-supplied account argument.
- Every MCP tool must use the same account authorization and ownership checks as REST.
- No platform-wide MCP token, operator context, direct internal data access or cross-account search is permitted.
- Do not publish an MCP endpoint until authentication, revocation, scope enforcement, audit, rate limiting, privacy and cross-account security tests pass.

## Mandatory cross-layer change protocol

For every change, assess and update all affected layers in the same branch:

| Layer | Required review |
|---|---|
| UI | Landing, login, dashboard, API-key console, responsive states, accessibility and account context |
| API | Routes, methods, schemas, account IDs, scopes, idempotency, errors and rate limits |
| Backend | Service logic, persistence, migrations, ownership predicates, secret boundaries and failure handling |
| Security | Authentication, authorization, account isolation, IDOR, SSRF, prompt injection and log redaction |
| Tests | Unit, regression, negative, cross-account and production smoke checks |
| Public docs | Landing Documentation tab, route examples, feature status and machine-readable agent guide |
| Technical docs | Relevant `docs/*.md`, API, auth, webhook, queue and MCP references |
| README | Capability matrix, repository map, local commands, flow and Mermaid diagrams |
| Handover | `HANDOVER.md` architecture, risks, operational notes and release checks |
| Change record | `CHANGELOG.md` date, scope, validation and deployment state |
| Generated assets | Rebuild `src/static-assets.mjs` whenever a bundled `public/` file changes |

If a layer is genuinely unaffected, explicitly record why. Never advertise a feature as live unless its backend and acceptance tests support that claim.

## Mandatory web ↔ Android companion parity

The repository contains an Android companion app in `ANDROID APK/`. It shares the production LeadMASTER web workspace and authenticated backend through a restricted HTTPS WebView; it is not an independent implementation of product business logic.

For every web coding change, assess whether it affects a feature, route, account flow, navigation item, responsive layout, download, notification, link or security boundary used by Android:

1. Trace the changed web feature to its Android entry point and confirm whether it is shared through the WebView or has a native integration.
2. If relevant, update and test the Android companion in the same branch so labels, routes, permissions, device behavior and user-visible states remain aligned with the web implementation.
3. Keep business rules, account ownership, authentication, API calls and persistence in the shared web/server implementation. Do not create a second Android-only version or weaken server authorization.
4. If unaffected, explicitly record why in the change summary or changelog; do not add irrelevant Android changes.
5. Review Android concerns for relevant changes: exact-origin HTTPS navigation, WebView bridge exposure, cookies/session continuity, system Back behavior, notification permission, external intents, downloads, keyboard/safe-area behavior and accessibility.
6. When Android source changes, run the Android APK workflow/build and report its result. Device-level acceptance remains separate from compilation.
7. Update `ANDROID APK/README.md` when app capabilities, navigation mapping, build steps, security boundaries or parity rules change.

Do not advertise a web feature as native Android functionality unless it is implemented and verified in the app. Shared WebView functionality may be described as available in the Android companion only when the corresponding production web route works inside the app.

## Engineering best practices

- Keep route parsing, authentication, authorization, business logic and persistence separate.
- Use parameterized SQL only.
- Validate content type, body size, schemas, enums, callback URLs and request limits server-side.
- Use cryptographically secure tokens, hashed API keys, encrypted webhook secrets and one-time secret reveal.
- Use constant-time signature comparisons.
- Treat user input, email content, URLs and webhook payloads as untrusted.
- Keep sensitive message content and credentials out of logs and error responses.
- Use idempotency for side effects and document uncertain outcomes.
- Preserve production behavior until migrations, compatibility checks and rollback are ready.
- Do not enable experimental features by toggling a flag alone.
- Never weaken human login protections to make an automated test pass.

## Screenshots and evidence

- Capture screenshots from the actual rendered UI, not fabricated mockups.
- Clearly label synthetic local preview captures; never present them as production evidence.
- Use an authorized test account for protected screens.
- Redact personal data, API keys, OTPs, account identifiers and webhook secrets.
- Use `src/dashboard-feature-map.md` to distinguish live API-backed dashboard features from unavailable modules; do not label unsupported sections as completed.
- Record screenshot viewport, environment and whether the image is production or local preview.

## Completion and reporting

- Report exactly what changed, what passed, what was deployed and what remains blocked.
- Distinguish branch code, merged code and production deployment.
- Do not say a migration, test, email, webhook, MCP connection or screenshot succeeded unless the result was observed.
- When a required account permission or session is missing, explain the blocker and request only the minimum user action needed.

## Mandatory LeadMASTER dashboard is the canonical UI

`src/Mandatory LeadMASTER Dashboard.html` is the mandatory visual source for the production dashboard. Treat its React markup, CSS, components, navigation, responsive behavior, icons, spacing and interactions as the design contract. Do not redesign, simplify, replace components, or change visual output while wiring APIs. Preserve the design and change only data, state, API actions and necessary truthful status copy. If a requested backend feature is not implemented, build the secure account-scoped backend first or mark that UI area unavailable; never leave preview-only fake data or local-success actions in production.

Before replacing `public/dashboard.html`, read `src/dashboard-feature-map.md`. It records existing API coverage, preview-only sections, the migration sequence and release acceptance checks. Keep the existing dashboard available as a rollback path until the new UI passes functional tests and desktop/mobile screenshot comparisons. Update Android navigation and test its WebView behavior whenever dashboard section IDs or connected workflows change.


## Authoritative LeadMASTER dashboard source

`src/Mandatory LeadMASTER Dashboard.html` is the mandatory source of truth for the production dashboard UI. Preserve its React component tree, embedded styling, layout, spacing, responsive breakpoints, icons and interaction design. Do not redesign or reimplement the dashboard when connecting features. Make the smallest data/API integration changes necessary, then mirror the file to `public/dashboard.html` and regenerate `src/static-assets.mjs` with `npm run build:assets`. The build script performs this synchronization. Keep dashboard features account-scoped and backed by real production APIs. Never display local preview/sample data as production information; where a backend capability is not implemented, present an explicit unavailable state rather than a simulated success. Assess Android companion parity for every dashboard change.


## Dashboard integration and Android section contract

Before every dashboard change, read `src/dashboard-feature-map.md`. Treat `src/Mandatory LeadMASTER Dashboard.html` as the canonical UI and preserve its React components and visual output. Keep `public/dashboard.html` identical and regenerate `src/static-assets.mjs` with `npm run build:assets`. Use only the real APIs listed in the feature map. Never display prototype records or report a local-only action as saved. Unsupported features must remain clearly unavailable until a secure account-scoped API exists. The Android bottom navigation must match the mandatory dashboard mobile destinations: `home`, `emails`, `audience`, `metrics`, `profile`; other modules remain reachable through the dashboard navigation drawer. Update Android in the same branch whenever a connected section ID, action or security behavior changes.


## Mandatory dashboard and Android parity contract

Before every dashboard change, read `src/dashboard-feature-map.md`. Treat `src/Mandatory LeadMASTER Dashboard.html` as the canonical UI and preserve its components and visual output. Keep `public/dashboard.html` byte-for-byte identical and regenerate `src/static-assets.mjs` with `npm run build:assets`. Use only real APIs in the feature map. Never show prototype records or report local-only actions as saved. Unsupported modules stay visibly unavailable until a secure account-scoped API exists. Preserve the isolated, sanitized HTML preview in Emails and Templates. Android bottom navigation must match `home`, `emails`, `audience`, `metrics`, `profile`; remaining modules stay in the dashboard drawer. Update and build Android in the same branch when section IDs, connected behavior or security changes.


## Header profile control

The dashboard header must contain only a compact profile SVG icon aligned at the far right (Cloudflare-style). Do not repeat the user's name/avatar or a Profile text tab in the header. The actual Profile page belongs only to the dashboard navigation (mobile bottom tab and desktop sidebar). The icon may expose the signed-in email and Log out; do not add a second profile-page destination. The authenticated login flow already redirects to `/dashboard.html`, which serves the mandatory dashboard; `/dashboard` redirects to that same canonical route. Replace any legacy dashboard rather than maintaining parallel dashboard implementations.


## Dashboard authentication is mandatory

Every dashboard document and supporting bundle must be protected by a server-validated `lm_session` cookie using `sessionFor()` before static asset lookup or upstream proxying. Normalize and decode URL paths before checking access; reject malformed paths, case variants, encoded separators and trailing-slash aliases. Unauthenticated dashboard requests must redirect to `/login.html`; never rely on React/client-side checks or hidden navigation. Keep the dashboard's HTML, JS, CSS, preview scripts and DOMPurify asset protected. Add regression tests whenever routes or assets change. Never proxy an unknown dashboard-like path to the preview upstream.


## Dashboard authentication is mandatory

Every dashboard document and supporting bundle must be protected by a server-validated `lm_session` cookie using `sessionFor()` before static asset lookup or upstream proxying. Normalize and decode URL paths before checking access; reject malformed paths, case variants, encoded separators and trailing-slash aliases. Unauthenticated dashboard requests must redirect to `/login.html`; never rely on React/client-side checks or hidden navigation. Keep the dashboard's HTML, JS, CSS, preview scripts and DOMPurify asset protected. Add regression tests whenever routes or assets change. Never proxy an unknown dashboard-like path to the preview upstream.
