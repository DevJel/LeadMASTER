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
