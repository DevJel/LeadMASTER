# LeadMASTER Android ↔ Production API/backend parity

## Architecture decision

The Android application is the official native shell for the same LeadMASTER production workspace. It loads the exact trusted HTTPS workspace origin configured in `WorkspaceViewModel.APP_HOST` and uses the dashboard's same-origin authenticated requests. The dashboard owns screen navigation, business rules, account data, API requests, validation, queue behavior and authorization.

This is intentional: the Android APK must not fork the backend, create a second account-data store, keep separate copies of mailbox state, or implement weaker client-side authorization. A feature is available in Android only when the shared production-backed workspace supports it.

- Android package: `pro.leadmaster.app`
- Production workspace origin: `https://leadmaster.jelvan.space`
- Entry route: `/login.html`
- Native shell: Kotlin + Jetpack Compose
- Shared dashboard: React application rendered inside a hardened Android WebView
- Backend: the same LeadMASTER production Worker, authenticated session and persistent stores used by the web app

## Screen and API map

The paths below are the actual same-origin paths used by the canonical dashboard / native notification monitor. Dynamic IDs are URL-encoded by the client.

| Android-visible capability | Shared dashboard/API path | Backend authority |
|---|---|---|
| Sign-in, password/OTP and session restoration | Existing `/login.html` flow and same-origin authentication requests | Worker authentication handlers and server-issued `lm_session` cookie |
| Inbox list | `GET /api/admin/mail?folder=inbox` | Authenticated mailbox API |
| Sent list | `GET /api/admin/mail?folder=sent` | Authenticated mailbox API |
| Deleted list | `GET /api/admin/mail?folder=deleted` | Authenticated mailbox API |
| Message detail and actions | `GET/PATCH /api/admin/mail/:id` | Authenticated mailbox API; ownership and allowed actions checked server-side |
| Compose/send | `POST /api/admin/send` | Existing email coordinator, queue and SES submission path |
| Assistant reply suggestions | `POST /api/admin/mail/:id/suggest` | Existing authenticated assistant route |
| HTML writing assistance | `POST /api/admin/email-html/assistant` | Existing authenticated HTML assistant route |
| Workspace records and automation actions | `POST /api/workspace/actions` | Existing authenticated workspace action dispatcher |
| Native notification activity | `GET /api/admin/activity` | Authenticated account activity API |
| Native notification inbox baseline | `GET /api/admin/mail?folder=inbox` | Same mailbox API as the Inbox screen |

Other dashboard modules continue to use their existing production-backed dashboard API modules. Do not infer a new public endpoint from a screen name; inspect the canonical dashboard and Worker route before adding any mapping.

## Identity, sessions and data ownership

1. Android WebView loads only the exact HTTPS host in `WorkspaceViewModel.APP_HOST`; other web origins are not treated as the app.
2. First-party cookies are enabled and third-party cookies are disabled.
3. API requests are made by the shared dashboard with same-origin credentials. The APK does not embed a LeadMASTER API key, SMTP password, Worker token or other backend secret.
4. The Worker validates the session, account ownership, permissions, request shape and state transition. Hiding a button in Android is not an authorization control.
5. Mailbox, contacts, templates, workspace records, settings and queue status remain server-owned. Android does not maintain an alternative business-data database.
6. The existing server session expiry and revocation rules remain authoritative. Closing the app does not create a second login system.

## Native Android responsibilities

Compose owns the app shell, loading/recovery surface and Android-specific integrations only:

- File selection is delegated to Android's document picker; the shared dashboard validates and uploads the selected files.
- Supported same-origin message downloads use Android DownloadManager with the current WebView session cookie.
- Notifications are local presentation of events read from the authenticated activity and inbox APIs; they do not replace server-side notification records or delivery state.
- Theme synchronization uses the restricted origin-checked WebMessage bridge.
- Back navigation follows the shared WebView history.

The JavaScript bridge is restricted to the trusted HTTPS origin and the small documented theme/notification message types. Never add arbitrary native method invocation, credential access or unrestricted file access.

## Blank-screen and navigation safeguards

- The shared dashboard is the single source of truth for tab routing and its explicit empty/unavailable states.
- Unsupported destinations must render the dashboard's visible `Feature not yet implemented.` state, not a blank screen and not a silent redirect to an unrelated tab.
- Empty lists must render their own empty-state copy; an empty dataset is not a navigation failure.
- After a main-frame page load, Android verifies that the login form or the shared workspace main content actually rendered before dismissing the native loading surface.
- If the document loads but the interface does not render, Android displays a recoverable workspace-rendering error and a retry action instead of exposing a white screen.
- A retry reloads the same secure workspace URL/session; it does not silently switch to another tab or use a different backend.

## Release verification

For every Android parity change:

1. Run the Worker authentication tests and the repository CI checks.
2. Run `gradle testDebugUnitTest lintDebug assembleDebug` in `ANDROID APK`.
3. Confirm the package remains `pro.leadmaster.app`, min SDK 26, target SDK 35, and Java/Kotlin 17.
4. Install and smoke-test sign-in/session restoration, Inbox, Sent, Deleted, Compose/send, Assistant, Settings, empty states, file picker, download and notification permission behavior on a real Android device or emulator.
5. Confirm that all dashboard data requests remain same-origin and that no API credentials are bundled in the APK.
6. Do not publish a production release APK unless the existing owner-controlled release keystore is available and signature verification passes.

## Source files

- `ANDROID APK/app/src/main/java/pro/leadmaster/app/MainActivity.kt` — hardened WebView, shared session, downloads, file picker, notifications and blank-render recovery.
- `ANDROID APK/app/src/main/java/pro/leadmaster/app/WorkspaceViewModel.kt` — exact trusted origin and workspace entry route.
- `ANDROID APK/app/src/main/java/pro/leadmaster/app/NativeLoadingOverlay.kt` — native loading and recovery UI.
- `required-componets-design/App.tsx` and `required-componets-design/UtilityApps.tsx` — shared dashboard navigation and module UI.
- `worker.js` and the `src/*-api.mjs` route modules — server-side API, validation and authorization.
