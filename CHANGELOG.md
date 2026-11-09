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
