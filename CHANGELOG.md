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
