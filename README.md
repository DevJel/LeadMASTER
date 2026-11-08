# LeadMASTER

LeadMASTER is intended to be a single-user email workspace with an interface inspired by modern transactional-email consoles. The current repository contains a responsive marketing page and login interface, an isolated Cloudflare Turnstile verification helper, an AWS SES SMTP transport and a queue/coordinator implementation, and fail-closed HTTP routing. It is **not a complete application and is not production-ready**.

The landing page includes CSS-animated conceptual product moments and a searchable documentation index. The illustrations are not live product activity or real metrics. The login hero intentionally keeps a minimal layout.

## Current status

| Capability | Status |
| --- | --- |
| Marketing landing page, login page, LeadMASTER logos and favicon | Implemented as static assets |
| Cloudflare queue and global 10-message-per-second rate control | Code and mock tests added; deployment, integration, recovery and runtime verification pending |
| Password entry, Turnstile widget and email-code screens | UI implemented; authentication service is not implemented |
| Turnstile server-side helper | Implemented and unit-tested; not connected to an endpoint |
| SES SMTP transport | Implemented and unit-tested with mock sockets; no live delivery verified |
| Admin secret allowlist, password verification, OTP and sessions | Required; not implemented |
| Experimental single-key email submission route | Implemented behind a disabled-by-default flag; mock tests only, no key-management UI, not production-ready or deployed |
| Dashboard, API key creation, audiences, webhooks and other console features | Intended, not implemented |
| Public Worker HTTP routing, robots.txt and llms.txt | Implemented; static preview deployed, full runtime verification pending |
| Cloudflare production deployment, storage, domain, rate limiting and monitoring | Not configured in this repository; a public preview exists |

The login remains disabled if its configuration endpoint cannot be reached. There are no sample users or simulated login in the application.

## Repository layout

```text
public/
  index.html                  Marketing landing page
  docs.html, docs.css         Public documentation page and styling
  robots.txt, llms.txt        Crawler policy and factual AI-readable overview
  landing-halftone.css        Styles adapted from the supplied landing design
  landing-halftone.js         Landing-page tabs and mobile navigation
  halftone.js                 Shared interactive landing and login wordmarks
  landing.css                 Previous landing styling (not used by current page)
  assets/marketing/           Previous landing artwork (not used by current page)
  login.html                  Login and verification screens
  login.css                   Responsive layout and styling
  login.js                    Client-side interaction and proposed API calls
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
test/                         Node unit tests using mock external boundaries
docs/API.md                   Module contracts and experimental API status
docs/QUEUE_DESIGN.md          Queue implementation and release gates
LOGIN_UI.md                   Login behavior and integration requirements
SES_TRANSPORT.md              SMTP setup and operational constraints
```

The landing page uses the original full logo, an interactive halftone wordmark, and links to the existing `login.html`; tabs describe only verified implementation status or clearly marked planned work, with links to the on-brand public documentation page rather than external repository links. Authentication remains unavailable. The full logo is used on both sides of the login; on the dark panel it is visually inverted by CSS, without changing the original SVG. The separate icon is retained for future suitable uses, and the gray favicon is referenced from the login HTML.

## Local checks

Run `node --test` from the repository root using a recent Node.js runtime. These tests do not contact Cloudflare or AWS. Opening `public/login.html` locally displays the layout, but sign-in is unavailable because no API server exists.

## Production prerequisites

A production release requires an authenticated Worker, a secure admin credential/allowlist design, single-use email verification and sessions, Turnstile site and secret keys, a verified SES identity and SMTP secrets, durable abuse controls and send-state handling, security review, a confirmed deployment account and domain, and real end-to-end tests. Credentials must remain in Cloudflare secret storage, never source control or browser code. See [LOGIN_UI.md](LOGIN_UI.md), [SES_TRANSPORT.md](SES_TRANSPORT.md) and [docs/API.md](docs/API.md) and [docs/QUEUE_DESIGN.md](docs/QUEUE_DESIGN.md).

## Public preview

The existing public preview at https://leadmaster-preview.projects-public-portfolio.workers.dev/ uses a temporary Worker with a KV-backed copy of public assets. It is not a production deployment; queue bindings and authentication are not configured. Preview assets and Worker routing require manual synchronization with repository changes. No actual email sending is enabled.
