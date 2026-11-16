# Customer errors, internal diagnostics and security controls

**Status:** Customer-safe error mapping is implemented. Internal diagnostic codes remain maintainer-only.

## Dual-tier error model

~~~mermaid
flowchart TD
  Failure[Worker / API / network / validation failure] --> Capture[Capture structured internal cause]
  Capture --> Classify[Map code and category]
  Classify --> Known{Known customer condition?}
  Known -->|Yes| CustomerCode[LM-USR-XXXX guide entry]
  Known -->|No| Internal[Fallback system code 342322]
  CustomerCode --> UI[Plain-language message and next step]
  Internal --> UI
  Internal --> Logs[Restricted logs with correlation evidence]
  UI --> Help[Public Help Center: customer codes only]
  Logs --> Maintainer[Internal troubleshooting docs]
~~~

## Customer-facing codes

Customer categories are:

- 1001–1099: Account Handling
- 2001–2099: Connections & Sync
- 3001–3099: Email & Contacts
- 4001–4099: Limits

The user interface shows a plain-language title, what happened and an actionable next step. The Help Center must expose only customer codes and must never return internal backend mappings.

## Internal diagnostics

- Unknown failures map to internal fallback `342322`.
- `docs/BACKEND_ERROR_CODES.md` is maintainer-only.
- Never expose SQL, stack traces, file paths, HTTP status details, provider responses, tokens, OTPs, SMTP credentials, API keys, message bodies or internal bindings in the browser.
- Keep diagnostic logs bounded and redacted; use request/correlation IDs rather than logging secrets.
- Do not put the internal fallback number in the customer-visible default message.

## Security invariants

1. All protected human routes validate a server session.
2. All account API routes validate key, scope and matching account/resource ownership.
3. Mutations enforce origin checks, bounded bodies, value validation and idempotency where needed.
4. Webhook secret is revealed once and encrypted at rest.
5. Suppression and permanent deletion controls retain explicit safety boundaries.
6. No provider or infrastructure status is presented as a LeadMASTER product feature.
7. Agent access uses account-bound REST keys, not human-login automation.
8. MCP is not mounted for production use.

## Source and tests

- Customer guide and mapper: `src/leadmaster-error-mapper.mjs`
- Internal code table: `docs/BACKEND_ERROR_CODES.md`
- Public Help Center: `public/help-center.html`
- Account boundary: `src/developer-api.mjs`, `src/developer-webhooks.mjs`
- Security and regression tests: auth, API isolation, error mapper and Help Center tests under `test/`
