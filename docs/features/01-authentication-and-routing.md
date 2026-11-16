# Authentication, authorization and clean page routing

**Status:** Implemented in Worker source. The active rollout supports one configured administrator identity; self-service registration, teams and multi-member roles are not available.

## Purpose and flow

Human login is separate from developer API authentication. A human administrator submits credentials and the human verification challenge, receives an email one-time code, then receives a server-validated session. Protected requests validate the session on the Worker; client-side hidden navigation is not an access control.

~~~mermaid
sequenceDiagram
  participant Browser
  participant Worker as LeadMASTER Worker
  participant Challenge as Human verification
  participant Mail as OTP delivery
  participant DB as Auth database
  Browser->>Worker: POST login credentials
  Worker->>Challenge: Verify challenge response
  Challenge-->>Worker: Valid / invalid
  Worker->>Mail: Send one-time code
  Mail-->>Browser: Verification email
  Browser->>Worker: POST OTP
  Worker->>DB: Atomically claim OTP and persist session
  DB-->>Worker: Session stored
  Worker-->>Browser: HttpOnly Secure SameSite cookie
  Browser->>Worker: GET /dashboard
  Worker->>DB: Validate session / expiry / revocation
  Worker-->>Browser: Existing dashboard asset or /login redirect
~~~

## Route contract

| Browser path | Internal asset | Access |
|---|---|---|
| `/` | `/index.html` | Public |
| `/login` | `/login.html` | Public |
| `/dashboard` | `/dashboard.html` | Authenticated |
| `/help-center` | `/help-center.html` | Public |
| `/docs` | `/docs.html` | Public redirect/information page |
| `/privacy` | `/privacy.html` | Public |
| `/terms` | `/terms.html` | Public |
| `/developer-api-keys` | `/developer-api-keys.html` | Authenticated |
| `/mcp-info` | `/mcp.html` | Public information only |

Old page `.html` paths receive a permanent redirect to the extensionless canonical path. Query parameters are preserved, including dashboard utility deep links such as `?app=notes`. The internal asset filename is not the public URL. Non-page resources such as scripts, stylesheets, SVG, WebP and API routes retain their file/API paths.

## Session and authorization rules

- Cookie: server-issued `lm_session`, HttpOnly, Secure and SameSite=Strict.
- Session state is validated server-side; expiry and revocation are checked before protected page assets or APIs are served.
- Logout revokes the server-side session and clears the browser cookie.
- Dashboard page, dashboard JS/CSS, preview JS/CSS, DOMPurify and developer-key page remain protected.
- Dashboard-like unknown paths remain inside the protected namespace and must not fall through to the upstream preview.
- Cookie-authenticated mutations enforce same-origin checks and bounded request bodies.
- Developer integrations use a separate account-owned Bearer API key, never a copied human cookie.

## Source and verification

- Worker entry and authentication/routing: `worker.js`
- Canonical route table: `src/page-routes.mjs`
- Human verification helper: `src/turnstile.mjs`
- Login UI/scripts: `public/login.html`, `public/login.js`
- Route tests: `test/page-routes.test.mjs`, `scripts/http-fixtures/auth-http-cases.mjs`, `test/auth-http.test.mjs`

## Not implemented

Public self-registration, password recovery workflow, team invitations, organization switching and user-managed roles must not be presented as live.
