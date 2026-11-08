# Production authentication and release notes

## Deployment

The production Worker is `leadmaster`, served on `https://leadmaster.jelvan.pro`.

- Cloudflare account: Projects - Works
- Worker entry point: `worker.js`
- Production deployment: latest version receives 100% traffic
- Turnstile hostname: `leadmaster.jelvan.pro`
- Turnstile actions: `managed` for the gateway challenge and `login` for the login form
- Administrator allowlist: `admin@work.jelvan.pro`
- Dedicated D1 database: `leadmaster-auth` (APAC)
- Existing application databases are not reused.

The Worker keeps the existing `TURNSTILE_SECRET` binding and adds the D1 and Secrets Store bindings needed for authentication and SES SMTP. Secrets are not stored in GitHub or returned to the browser.

## Sign-in flow

1. The gateway presents the Cloudflare Turnstile managed challenge.
2. After successful verification, a signed, HttpOnly challenge cookie is issued for 12 hours.
3. The login page loads the public Turnstile site key from `GET /api/auth/config`.
4. `POST /api/auth/login` checks same-origin, rate limits, verifies the `login` Turnstile action, enforces the administrator allowlist, checks the configured password, and sends a six-digit OTP.
5. `POST /api/auth/verify` validates the unexpired OTP, enforces attempt limits, consumes the code once, and creates an eight-hour server-side session.
6. The session cookie is Secure, HttpOnly and SameSite=Strict. Dashboard routes are checked against the D1 session record.
7. `POST /api/auth/logout` revokes the current session and expires the cookie.

D1 stores OTP challenge hashes, session-token hashes, expiries, attempt counts and rate-limit counters. The plaintext OTP and session token are not stored in D1.

## Branded email templates

The canonical HTML designs remain in:

- `public/email-otpformat.html`
- `public/email-securityalert.html`

The production Worker imports `src/email-templates.mjs`, generated from those two public files. A production consistency check confirmed that the bundled strings exactly match the current public HTML files. The preview's email-template URLs return 404, so the Worker does not fetch them remotely. When either public template changes, regenerate the module copy and redeploy the Worker.

### OTP template variables

| Placeholder | Value |
| --- | --- |
| `{{USER_NAME}}` | Administrator display name |
| `{{OTP_CODE}}` | Six-digit one-time code |
| `{{EXPIRY_MINUTES}}` | OTP lifetime in minutes (10) |

### Security alert template variables

| Placeholder | Value |
| --- | --- |
| `{{USER_NAME}}` | Administrator display name |
| `{{location}}` | Cloudflare request location |
| `{{time}}` | UTC sign-in time |
| `{{device}}` | Coarse device classification |
| `{{browser}}` | Browser family |
| `{{ip_address}}` | Request IP address |

Replacement values are HTML-escaped before insertion. The security alert is sent after a successful OTP login; its delivery is best-effort and does not invalidate an already-created session.

## Production static assets\n\nThe preview upstream was also found to be stale: its login JavaScript still redirected to the landing page and it returned 404 for `dashboard.html`. To avoid a repeat of that failure, the production Worker imports `src/static-assets.mjs`, generated from the current public login, dashboard and privacy files. It serves the current login page, login JavaScript/CSS, dashboard page, dashboard JavaScript/CSS, HTML preview assets, DOMPurify, privacy page, logo and favicon directly from the production Worker. The dashboard now checks the session and provides a POST-based logout action. The `dashboard.html` page remains a navigation shell; the underlying email-workspace services are not implemented.\n\n## SES SMTP configuration format

The Worker uses the existing SES SMTP transport module and Cloudflare Workers Sockets with implicit TLS:

- SMTP host format: `email-smtp.<region>.amazonaws.com`
- Region example: `ap-southeast-2`
- Port: `465` (implicit TLS)
- Authentication: SES SMTP username and SES SMTP password
- Sender: configured `SES_FROM_EMAIL` binding
- Recipient: the configured administrator address

The production bindings currently resolve the SMTP host, username and password from Cloudflare Secrets Store. The sender binding is mapped to the existing `ADMIN_EMAIL` secret. The sender identity must be verified in the same SES region, and the recipient must be permitted by the SES account's sending mode. This document uses the public AWS SES SMTP format only; it does not assert that the SES identity or live sending quota has been verified in the AWS account.

## Production validation and remaining gates

Verified from the Cloudflare configuration:

- The production Worker deployment is active at 100% traffic.
- The existing Turnstile secret binding is retained.
- The dedicated D1 binding is attached and the auth tables exist.
- SES SMTP credentials, administrator password and session-signing secret are referenced through Cloudflare Secrets Store bindings.
- The live hostname serves the intended Turnstile challenge page. The custom Worker domain is enabled and the proxied DNS record remains present.
- The canonical templates and current login/dashboard assets are bundled into the deployed Worker; production rendering no longer depends on the stale preview asset cache.

Not independently verified:

- Successful interactive Turnstile completion in a real browser.
- The administrator password value matches the expected credential.
- The SES sender identity is verified and SMTP delivery succeeds to the administrator mailbox.
- An end-to-end login, OTP, security-alert receipt, dashboard access and logout test using the real administrator.

The authentication gateway is deployed, but do not treat the complete LeadMASTER email-workspace product as production-complete: the dashboard remains a shell and email sending, audiences, campaign management, template persistence, and related application backends are not implemented.
