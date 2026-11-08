# LeadMASTER

LeadMASTER is intended to be a single-user email workspace with an interface inspired by modern transactional-email consoles. The current repository contains a responsive marketing page and login interface, an isolated Cloudflare Turnstile verification helper, and an isolated AWS SES SMTP transport. It is **not a complete application and is not production-ready**.

## Current status

| Capability | Status |
| --- | --- |
| Marketing landing page, login page, LeadMASTER logos and favicon | Implemented as static assets |
| Cloudflare queue and global 10-message-per-second rate control | Required; design documented, not implemented |
| Password entry, Turnstile widget and email-code screens | UI implemented; authentication service is not implemented |
| Turnstile server-side helper | Implemented and unit-tested; not connected to an endpoint |
| SES SMTP transport | Implemented and unit-tested with mock sockets; no live delivery verified |
| Admin secret allowlist, password verification, OTP and sessions | Required; not implemented |
| Dashboard, email management, API keys, audiences, webhooks and other console features | Intended, not implemented |
| Cloudflare deployment, storage, domain, rate limiting and monitoring | Not configured in this repository |

The login remains disabled if its configuration endpoint cannot be reached. There are no sample users or simulated login in the application.

## Repository layout

```text
public/
  index.html                  Marketing landing page
  landing.css                 Responsive marketing styling
  assets/marketing/           Optimized embedded WebP artwork
  login.html                  Login and verification screens
  login.css                   Responsive layout and styling
  login.js                    Client-side interaction and proposed API calls
  cover.css                   Embedded animated login cover
  assets/brand/               Original full logo, icon and favicon SVGs
src/
  turnstile.mjs               Server-side Turnstile validation helper
  ses-smtp.mjs                SES SMTP transport helper
test/                         Node unit tests using mock external boundaries
docs/API.md                   Module contracts and unimplemented HTTP API
docs/QUEUE_DESIGN.md          Proposed queue and rate-control design
LOGIN_UI.md                   Login behavior and integration requirements
SES_TRANSPORT.md              SMTP setup and operational constraints
```

The full logo is used on both sides of the login; on the dark panel it is visually inverted by CSS, without changing the original SVG. The separate icon is retained for future suitable uses, and the gray favicon is referenced from the login HTML.

## Local checks

Run `node --test` from the repository root using a recent Node.js runtime. These tests do not contact Cloudflare or AWS. Opening `public/login.html` locally displays the layout, but sign-in is unavailable because no API server exists.

## Production prerequisites

A production release requires an authenticated Worker, a secure admin credential/allowlist design, single-use email verification and sessions, Turnstile site and secret keys, a verified SES identity and SMTP secrets, durable abuse controls and send-state handling, security review, a confirmed deployment account and domain, and real end-to-end tests. Credentials must remain in Cloudflare secret storage, never source control or browser code. See [LOGIN_UI.md](LOGIN_UI.md), [SES_TRANSPORT.md](SES_TRANSPORT.md) and [docs/API.md](docs/API.md) and [docs/QUEUE_DESIGN.md](docs/QUEUE_DESIGN.md).
