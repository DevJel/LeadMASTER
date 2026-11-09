# LeadMASTER

LeadMASTER is an email workspace served in production at **https://leadmaster.jelvan.pro**. The Cloudflare Worker named `leadmaster` provides administrator password + Turnstile + email OTP authentication, D1-backed opaque sessions, a protected developer API-key console, a server-to-server email API, signed webhook subscriptions and AWS SES SMTP transport.

The full email-workspace product is not complete. The dashboard remains a navigation shell; campaigns, audiences, persistent template management, analytics and the production Queue/ Durable Object sending pipeline are not implemented. Authenticated SES and webhook callback acceptance tests still require controlled end-to-end verification.

## Current capability matrix

| Area | Current status | Important boundary |
| --- | --- | --- |
| Landing page and documentation | Production Worker serves the landing page; documentation is integrated into its Documentation tab | `public/index.html` is canonical; `docs.html` and `mcp.html` are compatibility redirects |
| Administrator authentication | Deployed | Turnstile action `login`, allowlisted administrator password, six-digit email OTP, D1 session |
| Password storage format | PBKDF2 supported | Legacy secret-value format remains accepted; do not claim PBKDF2-only enforcement |
| Sessions | Deployed opaque sessions | 32-byte random token, SHA-256 hash in D1, eight-hour Secure/HttpOnly/SameSite=Strict cookie; not JWT |
| SES SMTP | Bound to Worker | OTP, best-effort security alerts and developer email submissions; live delivery acceptance tests remain outstanding |
| Developer API keys | Deployed | Admin-session protected console; keys shown once and stored as hashes; scopes: `email:send`, `email:read`, `webhook:manage` |
| Email API | Deployed route and handler | `POST /api/v1/emails`, `GET /api/v1/emails/{id}`; actual authenticated acceptance tests pending |
| Webhooks | Deployed route and handler | HMAC-SHA256 signatures; one synchronous attempt, no retry/replay or dead-letter recovery |
| Dashboard | Shell only | No complete mailbox, campaign, audience or template-management backend |
| Queue / Durable Object | Experimental source modules | Not bound or deployed as the production send pipeline |
| MCP | Experimental read-only source prototype | Not mounted in production; no public MCP endpoint or email-send tool |
| Privacy and terms | Draft notices | Not effective agreements; require legal and operational review before broader launch |

## Production architecture

- **Cloudflare Worker:** `leadmaster`, entry point `worker.js`, production hostname `leadmaster.jelvan.pro`.
- **D1:** dedicated `leadmaster-auth` database, binding `AUTH_DB`.
- **Secrets Store:** administrator credentials, SES SMTP credentials, Turnstile Siteverify secret and session signing/encryption secret.
- **Turnstile:** public site key in Worker variable `TURNSTILE_SITE_KEY`; secret binding `TURNSTILE_SECRET`.
- **SES SMTP:** configured sender `hello@work.jelvan.pro`; configured transport is not proof of successful delivery.
- **Static UI:** canonical files under `public/`; generated production bundle at `src/static-assets.mjs`.

## Repository layout

```text
public/
  index.html                 Production landing page + integrated documentation
  landing-halftone.css       Landing and documentation styling
  landing-halftone.js        Landing tabs, docs search/filter and deep-link behavior
  login.html, login.js       Password, Turnstile and OTP sign-in UI
  dashboard.html             Protected dashboard shell
  developer-api-keys.html    Protected API-key and webhook console
  docs.html, mcp.html        Legacy URLs redirect into landing-page documentation
  assets/                    Brand and vendored public assets
src/
  worker.js                  Root Worker entry point is worker.js
  static-assets.mjs          Generated production asset bundle
  backend modules            Auth, SES SMTP, API, webhooks and routing
docs/
  API.md                     Developer API and webhook contract
  PRODUCTION_AUTH.md         Actual authentication and release notes
  QUEUE_DESIGN.md            Experimental queue design and release gates
  MCP.md                     Experimental MCP security and capability notes
AGENTS.md                    Mandatory repository change and validation rules
HANDOVER.md                  Root operational handover and release runbook
CHANGELOG.md                 Human-readable implementation history
scripts/
  build-static-assets.mjs    Regenerates the Worker static asset bundle
```

## Local development and checks

```bash
npm ci --ignore-scripts
npm run build:assets
npm test
```

Tests use local/mock boundaries. They do not prove production login, Turnstile Siteverify, SES inbox delivery, webhook callback receipt or production quota behavior.

## Documentation

The public documentation hub is part of the landing page: **https://leadmaster.jelvan.pro/#documentation**. The Worker serves the canonical landing page from its generated asset bundle at both `/` and `/index.html`. Old `/docs.html` and `/mcp.html` URLs redirect to relevant sections of the landing page. Repository engineering documents remain under `docs/`; they are source documentation, not separate public documentation destinations.

## Production release

Read [AGENTS.md](AGENTS.md) before modifying the project and [HANDOVER.md](HANDOVER.md) before deploying or transferring ownership. Never deploy without checking the intended Cloudflare account, current bindings, static asset generation, tests, production route checks and rollback path. Keep secrets out of source control. Do not mark a feature complete until the UI, API, backend, tests and documentation accurately reflect the same implemented behavior.

## Security and privacy

Use least-privilege API scopes, keep credentials server-side, redact authorization/signature headers, validate webhook signatures before parsing JSON, and do not bypass Turnstile, OTP limits or session checks. Webhook URL validation does not fully prevent DNS rebinding. Privacy and terms pages are drafts and require review before expanding audience/campaign processing.


## AI agents and machine-readable documentation

- Canonical agent guide: [https://leadmaster.jelvan.pro/llms.txt](https://leadmaster.jelvan.pro/llms.txt)
- Crawler policy: [https://leadmaster.jelvan.pro/robots.txt](https://leadmaster.jelvan.pro/robots.txt)
- Public documentation: [https://leadmaster.jelvan.pro/#documentation](https://leadmaster.jelvan.pro/#documentation)
- Agent authentication is through server-side LeadMASTER API keys and documented REST scopes. Agents must not automate human administrator sign-in, security challenges or email OTP.
- MCP is not available in production. Use the REST API; `/mcp` returns an explicit unavailable response.
- Keep public product copy vendor-neutral and refer to the product as LeadMASTER. Internal platform details belong only in engineering handover/configuration, not the UI.
