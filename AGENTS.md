# Agent instructions for LeadMASTER

These rules apply to every AI agent, developer, automation and contributor.

## Read first
Before changing code, read `HANDOVER.md`, `README.md`, the relevant source module/tests and the matching `docs/*.md`. Inspect the current `main` branch and production Worker configuration; never rely only on prior chat or an old commit summary.

## Mandatory cross-layer change protocol
For every change, assess and update all affected layers in the same change set:

| Layer | Required review |
|---|---|
| UI | Landing, login, dashboard, API-key console, mobile/responsive states, accessibility and user-facing copy |
| API | Routes, methods, request/response schemas, scopes, errors, idempotency, rate limits and compatibility |
| Backend | Worker routing, D1 migrations/queries, Secrets Store bindings, SES, webhook/queue behavior and failure handling |
| Tests | Unit, regression, negative/security cases and production smoke checks where possible |
| Public docs | Landing-page Documentation tab, anchors, search/filter index and public status copy |
| Engineering docs | Relevant `docs/*.md`, API/auth/queue/MCP references and architecture diagrams |
| README | Capability matrix, repository map, local commands and release status |
| Handover | `HANDOVER.md` architecture, operations, risks, acceptance checks and deployment state |
| Change record | `CHANGELOG.md` with date, scope, validation and deployment state |
| Generated assets | Rebuild `src/static-assets.mjs` whenever bundled `public/` files change |

If a layer is genuinely unaffected, explicitly record why. Never advertise a feature as live unless the backend and required operational checks support that statement.

## Source of truth
- Repository: `DevJel/LeadMASTER`, branch `main`.
- Production: `https://leadmaster.jelvan.pro`, Cloudflare Worker `leadmaster`.
- Worker entry: `worker.js`.
- Canonical public UI: `public/`.
- Generated production asset map: `src/static-assets.mjs`.
- D1 schema: `migrations/`; do not reuse another application's database.
- Secrets: Cloudflare Secrets Store only. Never commit or print secret values.
- The landing page is the public documentation hub. `/docs.html` and `/mcp.html` are compatibility redirects. Engineering references remain in `docs/`.

## Security and engineering invariants
- Preserve same-origin checks, Turnstile Siteverify, hostname/action validation, rate limits, OTP expiry/attempt limits, session validation/revocation, API-key scopes and webhook signature verification.
- Fail closed if required security configuration is missing. Never bypass security to make a test pass.
- Use reviewed, additive D1 migrations for schema changes.
- Scope API-key data access to the owning key.
- `accepted` means SES accepted SMTP submission, not inbox delivery.
- Webhook HMAC input is the exact timestamp + period + raw body; compare in constant time and reject stale/duplicate events.
- Webhook URL checks do not pin DNS and do not fully prevent DNS rebinding. Never claim complete SSRF protection.
- Queue and MCP modules are experimental unless their bindings, routing, authorization, monitoring and end-to-end tests are actually deployed.
- Sessions are opaque random tokens stored as hashes in D1, not JWTs.
- PBKDF2 is supported, but legacy password values remain accepted until an approved migration is completed.
- Do not rotate `SESSION_SECRET` casually; it is used for OTP HMAC and webhook-secret encryption. Plan re-encryption/migration first.

## Required local validation
```bash
npm ci --ignore-scripts
npm run build:assets
npm test
```
Also inspect the full diff, run `git diff --check`, and verify landing-page tabs, search, filters, deep links, mobile layout and legacy redirects. Verify auth, API scopes/idempotency/status/errors, webhook HMAC/replay behavior, D1 migrations and bindings.

Mocked unit tests do not prove live Turnstile, SES inbox delivery, browser login, callback receipt or production quota behavior. State exactly what was and was not tested.

## Deployment and completion
1. Confirm the intended Cloudflare account and Worker.
2. Inspect current bindings, migrations and deployed version.
3. Build static assets and run tests.
4. Review the full source/config diff; never deploy placeholders or missing secrets.
5. Deploy using the approved workflow (normally `npx wrangler deploy` from the verified repo).
6. Verify landing page, docs tab, legacy redirects, login config, protected routes, API route behavior and active Worker version.
7. Record deployment/version, checks, remaining blockers and rollback notes in `HANDOVER.md` and `CHANGELOG.md`.
8. A change is complete only when UI/API/backend/tests/docs/README/handover agree, generated assets are current, and deployment/test claims are truthful.


## Public product identity and confidentiality
- In all user-facing UI, landing pages, login screens, dashboard copy, API docs, `llms.txt`, generated examples and public status text, refer to the product as **LeadMASTER**.
- Never disclose underlying hosting, database, deployment, infrastructure, email transport, SMTP, provider, account, secret-store, internal worker or vendor names/status in product UI or customer-facing explanations. Describe only LeadMASTER capabilities and observable behavior.
- Do not expose internal binding names, account IDs, database IDs, secret names, deployment identifiers, provider dashboards or infrastructure diagrams in public product surfaces.
- This rule does not remove accurate internal detail from private engineering handover, source code, infrastructure configuration or legally required privacy disclosures. Keep those details access-appropriate.
- AI agents must use documented LeadMASTER REST APIs with least-privilege API keys. Human administrator login, visual security verification, passwords and email OTP are never agent authentication. Never scrape, solve, bypass, replay or disclose challenge tokens or site keys.
- Never claim MCP is available. The current prototype is not mounted in production; reserve `/mcp` with an explicit unavailable response and document the REST API as the supported integration.
- Keep `llms.txt` and `robots.txt` aligned with the deployed API, feature matrix, MCP status, limits and security boundaries. Remember robots directives are crawler preferences, not access controls.
