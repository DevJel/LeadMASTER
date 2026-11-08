# LeadMASTER

LeadMASTER is a single-administrator email workspace with an interface inspired by modern transactional-email consoles. The production `leadmaster` Worker now provides the domain gateway, Turnstile challenge, password + email OTP authentication, D1-backed sessions and rate limits, and branded OTP/security-alert email templates through AWS SES SMTP. The wider email-workspace product remains incomplete: the dashboard is still a navigation shell and sending, audience, template-management, and other console backends are not production-ready.

The landing page includes CSS-animated conceptual product moments and a searchable documentation index. The illustrations are not live product activity or real metrics. The login hero intentionally keeps a minimal layout.

## Current status

| Capability | Status |
| --- | --- |
| Marketing landing page, login page, LeadMASTER logos and favicon | Implemented as static assets |
| Cloudflare queue and send-rate control | 10-per-second and conservative rolling 50,000-per-day coordinator guards have mock tests; bindings, integration, recovery and runtime verification pending |
| Password entry, Turnstile widget and email-code screens | Implemented; production Worker verifies Turnstile, checks the configured administrator password, issues a single-use email OTP and creates an HttpOnly session |
| Turnstile server-side verification | Connected to the production gateway; hostname and action are checked server-side |
| SES SMTP transport | Connected to OTP and security-alert flows; SMTP delivery has not been independently verified against a live recipient |
| Admin password allowlist, OTP and sessions | Single admin allowlist (`admin@work.jelvan.pro`), password verification, hashed single-use OTP, expiry/attempt limits and D1-backed sessions implemented in the production Worker |
| Experimental single-key text/HTML email submission route | Implemented behind a disabled-by-default flag; mock tests only, no key-management UI, not production-ready or deployed |
| Dashboard | Responsive navigation shell with a local, unsaved HTML preview for Emails and Templates; no authenticated data, sending or template backend |
| API key creation, audiences, webhooks and other console features | Intended, not implemented |
| Experimental read-only MCP integration | Disabled by default; local tests only, not deployed; no email sending via MCP |
| Public Worker HTTP routing, robots.txt and llms.txt | Implemented; static preview deployed, full runtime verification pending |
| Cloudflare production authentication deployment | `leadmaster` Worker deployed with Turnstile, dedicated `leadmaster-auth` D1 and Secrets Store bindings; production route remains on `leadmaster.jelvan.pro`; full product backend and live email-delivery verification remain outstanding |

The login remains disabled if its configuration endpoint cannot be reached. There are no sample users or simulated login in the application. The production Worker serves current login and dashboard assets from its own bundle; it does not rely on the stale preview asset cache.

## Repository layout

```text
public/
  index.html                  Marketing landing page
  docs.html, mcp.html        Public documentation pages
  docs.css                   Public documentation styling
  privacy.html, terms.html    Draft legal notices, not yet effective
  legal.css                   Draft legal-page styling
  robots.txt, llms.txt        Crawler policy and factual AI-readable overview
  landing-halftone.css        Styles adapted from the supplied landing design
  landing-halftone.js         Landing-page tabs and mobile navigation
  halftone.js                 Shared interactive landing and login wordmarks
  landing.css                 Previous landing styling (not used by current page)
  assets/marketing/           Previous landing artwork (not used by current page)
  login.html                  Login and verification screens
  login.css                   Responsive layout and styling
  login.js                    Client-side interaction with deployed auth endpoints
  dashboard.html              Responsive workspace navigation shell
  dashboard.css, dashboard.js Dashboard styling and navigation (no backend)
  html-preview.css, html-preview.js  Isolated local email/template HTML preview
  assets/vendor/              Locally vendored DOMPurify and its license
  cover.css                   Embedded animated login cover
  assets/brand/               Original full logo, icon and favicon SVGs
src/
  turnstile.mjs               Server-side Turnstile validation helper
  ses-smtp.mjs                SES SMTP transport helper
  email-queue-core.mjs        Enqueue and serialized dispatch logic
  email-queue-worker.mjs      Cloudflare Queue / Durable Object adapter
  queue-batch.mjs             Queue acknowledgement and retry handling
  http-router.mjs             Static routing, fail-closed auth, opt-in email API route
  email-api.mjs               Experimental guarded email submission boundary
  mcp-server.mjs              Experimental read-only MCP endpoint
test/                         Node unit tests using mock external boundaries
docs/API.md                   Module contracts and experimental API status
docs/QUEUE_DESIGN.md          Queue implementation and release gates
docs/HTML_PREVIEW.md          Preview usage, limitations and security
LOGIN_UI.md                   Login behavior and integration requirements
SES_TRANSPORT.md              SMTP setup and operational constraints
```

The landing page uses the original full logo, an interactive halftone wordmark, and links to `login.html`. Production authentication is available through the `leadmaster` Worker gateway; the full email workspace is not yet feature-complete. The full logo is used on both sides of the login; on the dark panel it is visually inverted by CSS, without changing the original SVG. The separate icon is retained for future suitable uses, and the gray favicon is referenced from the login HTML.

## Local checks

Run `npm ci --ignore-scripts` followed by `npm test` from the repository root using a recent Node.js runtime. These tests do not contact Cloudflare or AWS. Opening `public/login.html` locally displays the layout, but sign-in is unavailable because no API server exists.

## Production prerequisites

A production release requires an authenticated Worker, a secure admin credential/allowlist design, single-use email verification and sessions, Turnstile site and secret keys, a verified SES identity and SMTP secrets, durable abuse controls and send-state handling, security review, a confirmed deployment account and domain, and real end-to-end tests. Credentials must remain in Cloudflare secret storage, never source control or browser code. See [LOGIN_UI.md](LOGIN_UI.md), [SES_TRANSPORT.md](SES_TRANSPORT.md) and [docs/API.md](docs/API.md) and [docs/QUEUE_DESIGN.md](docs/QUEUE_DESIGN.md).

## Public preview

The existing public preview at https://leadmaster-preview.projects-public-portfolio.workers.dev/ uses a temporary Worker with a KV-backed copy of public assets. It is not a production deployment; queue bindings and authentication are not configured. Preview assets and Worker routing require manual synchronization with repository changes. No actual email sending is enabled.

## Draft legal notices

Privacy and terms pages cover the current preview only and are explicitly marked drafts, not effective agreements. Before publication, the operator must confirm the legal entity and address, privacy contact, governing law, actual provider processing and international transfers, cookies, retention and deletion schedules, data-rights procedure, and review the terms and service-specific obligations with qualified counsel. Update both notices before enabling authentication, email, campaigns, AI or MCP features. Do not treat a link to a draft as evidence of legal acceptance.

### Experimental MCP integration

The repository includes a disabled-by-default, read-only MCP endpoint. It can describe its limited capabilities and validate message input; it cannot send or queue email. It is not present in the public preview and is not production-ready. See [MCP implementation notes](docs/MCP.md) for security, configuration and release gates.


## Production authentication

See [Production authentication and release notes](docs/PRODUCTION_AUTH.md) for the deployed Worker, D1 schema, required secret bindings, Turnstile checks, SES SMTP configuration format, branded email-template placeholders, and remaining release checks. The public HTML files in `public/` are the canonical email designs; a generated module copy is bundled into the Worker so production email delivery does not depend on the separately hosted preview asset cache.
