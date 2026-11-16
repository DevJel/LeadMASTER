# AI reply assistance

**Status:** User-triggered reply suggestion is implemented. AI does not autonomously send email or execute workflow actions.

## Flow

~~~mermaid
sequenceDiagram
  participant Admin
  participant Dashboard
  participant Worker
  participant DB as Mailbox history
  participant AI as AI model
  Admin->>Dashboard: Open message and choose Suggest a reply
  Dashboard->>Worker: POST /api/admin/mail/{id}/suggest
  Worker->>Worker: Validate session, origin and bounded prompt/context
  Worker->>DB: Load current message and permitted related history
  DB-->>Worker: Limited context
  Worker->>AI: Generate a reply suggestion
  AI-->>Worker: Candidate text / controlled HTML
  Worker->>Worker: Validate output and sanitize markup
  Worker-->>Dashboard: Draft suggestion
  Admin->>Dashboard: Review and edit
  Admin->>Dashboard: Explicitly submit email
  Dashboard->>Worker: Normal authenticated send operation
~~~

## Rules

- User explicitly requests the suggestion.
- The current message is the primary context; related sent/received history may be used when available.
- Email content is untrusted input. Instructions contained in an email cannot override system rules, authorize secret disclosure or trigger an autonomous send.
- Output is a draft. Human review and an explicit send action remain required.
- AI binding/model failures are mapped to the standard customer-safe error handler. Raw model/provider responses must not be exposed.

## Source

- Dashboard suggestion action: `required-componets-design/App.tsx`
- Worker suggestion route: `worker.js`
- Sanitization and response validation: source modules referenced by the route
- Internal diagnostics: `docs/BACKEND_ERROR_CODES.md`
- API/UI tests for suggestion flow under `test/`

## Not available

No autonomous reply, agentic inbox action, auto-send policy, multi-step workflow or general production chatbot is part of this feature.
