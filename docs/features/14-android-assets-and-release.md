# Android, generated assets and release verification

**Status:** Android uses a Jetpack Compose native shell for branded loading/recovery and an app-specific Material-style sign-in presentation. Authenticated workspace modules continue to use the shared secure WebView and production APIs; no business data or authentication logic is duplicated. The Worker uses a generated static asset map. A successful build is not proof of a signed production Android release or a production Worker deployment.

## Android flow

~~~mermaid
flowchart TD
  User[Android user] --> App[LeadMASTER Android application]
  App --> WebView[Secure WebView]
  WebView --> URL[Canonical dashboard URL]
  URL --> Worker[LeadMASTER Worker]
  Worker --> Session[Server session cookie]
  Session --> UI[Shared responsive React dashboard]
  UI --> APIs[Same authenticated API routes]
  APIs --> D1[Account-owned data]
  APIs --> Mail[Shared sending / inbound services]
~~~

Android shares the dashboard UI and backend; it must not duplicate a second, divergent business-data implementation. Preserve HTTPS origin restrictions, cookie handling, navigation/back behavior, downloads and only the permissions actually needed.

## Asset generation

~~~mermaid
flowchart LR
  TSX[Canonical React source] --> Build[Build static assets]
  CSS[Shared Tailwind/CSS source] --> Build
  HTML[Canonical dashboard HTML] --> Build
  Public[Public files and reference assets] --> Build
  Build --> JS[public/dashboard-app.js]
  Build --> Sheet[public/dashboard-app.css]
  Build --> Mirror[public/dashboard.html]
  Build --> Bundle[src/static-assets.mjs]
  Bundle --> Worker[Static Worker asset lookup]
~~~

The public directory is the asset source for static pages; `src/static-assets.mjs` is generated. Never hand-edit the generated map. Build process synchronizes the dashboard mirror with `src/Mandatory LeadMASTER Dashboard.html`.

## Required release gates

1. `npm ci`
2. `npm run build:assets`
3. `npm test`
4. `npm run check:dashboard`
5. Verify generated assets have no uncommitted drift.
6. Run `node scripts/capture-screenshots.mjs` and inspect desktop/mobile screenshots.
7. Run Worker route/auth regression checks.
8. Complete authenticated browser smoke tests for login, session expiry/logout, inbox, send status, suppression, API keys and webhooks.
9. Build Android when native or shared dashboard behavior changes; perform device acceptance.
10. Record actual deployed Worker version, routes checked, test evidence and any remaining limitations.

## Source

- Android implementation: `ANDROID APK/`
- Dashboard TSX: `required-componets-design/`
- CSS and bundled app generation: `scripts/build-static-assets.mjs`
- Component check: `scripts/check-dashboard-bundle.mjs`
- Browser screenshots: `scripts/capture-screenshots.mjs`
- Worker asset serving: `worker.js`
