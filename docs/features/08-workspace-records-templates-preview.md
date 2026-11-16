# Workspace records, templates and HTML preview

**Status:** Account-scoped workspace record API is implemented. Template features are partial. HTML preview is browser-local.

## Workspace record flow

~~~mermaid
sequenceDiagram
  participant UI as Dashboard / utility module
  participant Worker
  participant API as Workspace records route
  participant D1 as Workspace record table
  UI->>Worker: POST /api/workspace/actions
  Worker->>Worker: Validate current session and same origin
  Worker->>API: Bounded action + collection + arguments
  API->>API: Check collection allowlist and value size
  alt Create
    API->>D1: Insert-or-ignore with account + idempotency key
  else List
    API->>D1: Select where account_id and collection match
  else Replace / Delete
    API->>D1: Mutate only matching id + account + collection
  end
  D1-->>API: Owned record result
  API-->>UI: Safe result / friendly error
~~~

## Supported workspace collections

- `leadmaster_prefs`
- `leadmaster_messages`
- `leadmaster_templates`
- `leadmaster_rules`
- `leadmaster_scheduled`
- `leadmaster_contacts`
- `leadmaster_reminders`
- `leadmaster_notes`

These are account-owned JSON records accessed through a strict collection allowlist. The API limits the request body and each record value, lists at most 500 records, requires idempotency keys for create, and includes the account ID and collection in every mutation predicate.

### Actions

| Action | Behavior |
|---|---|
| `records.list` | Return account-owned records for one allowed collection |
| `records.create` | Insert-or-ignore using account, collection and caller-supplied idempotency key |
| `records.replace` | Replace a single owned record |
| `records.delete` | Delete a single owned record |

## Template capability boundary

The current dashboard template API supports account-scoped list/create and retrieval/insertion into the composer. Full edit/delete template management must not be advertised until the corresponding routes and UI operations are implemented, persisted, and tested. Do not mistake a local template preview for a saved server-side template.

## HTML preview

~~~mermaid
flowchart TD
  Input[User-authored HTML] --> Sanitize[DOMPurify and allowlist cleanup]
  Sanitize --> Sandbox[Sandboxed preview frame]
  Sandbox --> CSP[Restrictive content policy]
  CSP --> Render[Local rendered preview]
  Render --> Export[Optional browser download]
  Render -. no send side effect .-> None[No email sent]
  Render -. no persistence side effect .-> None
~~~

Preview output is browser-local. It is sanitized before being placed into a sandboxed frame with a restrictive content policy. Preview is not proof of email client rendering and does not send or persist a message.

## Source and tests

- `src/leadmaster-records-api.mjs`
- `src/email-templates-api.mjs`
- `src/email-templates.mjs`
- `src/recipient-import.mjs`
- `public/html-preview.js`, `public/html-preview.css`, DOMPurify asset
- `docs/HTML_PREVIEW.md`, `docs/FULL_PAGE_COMPOSER.md`
- Workspace ownership and template tests under `test/`
