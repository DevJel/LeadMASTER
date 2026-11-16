# LeadMASTER AI Assistant and agent workflow

## Overview

The dashboard Assistant tab uses the existing Cloudflare Workers AI binding. The current agent model is @cf/meta/llama-3.3-70b-instruct-fp8-fast, which supports traditional function calling. Inference is metered under Cloudflare Workers AI pricing; it is not an unmetered local model. Check the model catalog for current pricing and availability before increasing usage.

The Assistant is a bounded administrator-facing agent, not a general-purpose administrator credential. It uses a small server-defined tool registry and does not accept arbitrary tool names, URLs, SQL, shell commands, or user-selected account IDs.

## Request flow

1. The administrator opens the Assistant tab and submits a message.
2. The dashboard sends the last bounded conversation messages to POST /api/admin/assistant using the same-origin authenticated session.
3. The Worker verifies the session, configured administrator identity, HTTP method and Origin.
4. The Worker validates message roles, sizes and conversation length, then applies a per-account request limit.
5. Workers AI receives the system policy, conversation and the server-owned tool schemas.
6. The Worker validates every tool name and argument before running a fixed implementation.
7. Tool results are returned to the model for a final answer. The tool loop is capped at three rounds and four tool calls.
8. The dashboard displays the answer, tool activity and any prepared email.
9. A prepared email can be moved into Compose. The user must review and send it through the normal send workflow.

No conversation history is persisted by this route; the current browser component holds the conversation in page state.

## Available agent tools

| Tool | Capability | Side effects |
|---|---|---|
| get_inbox_overview | Read count and newest active received messages | Read-only |
| search_inbox | Search received messages by sender or subject | Read-only |
| get_message | Read the plain-text content of one received message from R2 | Read-only |
| prepare_email | Prepare an unsent email when the exact recipient was provided by the user | Returns a draft for review; never sends |

Message body text is untrusted input. Instructions contained inside emails cannot authorize tools, change account context, or override the system policy. The agent cannot read secret values, administrator credentials, OTP values, private API keys, or external SMTP credentials.

## Explicitly unsupported actions

The agent does not:
- Send an email or campaign.
- Archive, delete, move or mark messages as read.
- Create, edit or activate automation rules.
- Change SMTP settings, API keys, webhooks, account settings or permissions.
- Connect Gmail, Google Contacts, Notion or other third-party accounts.
- Execute arbitrary HTTP requests, SQL, JavaScript or shell commands.

Email sending remains in the normal Compose flow. The user sees the exact recipient, subject and body and must use the existing send confirmation workflow.

## API contract

Endpoint: POST /api/admin/assistant

Authentication: authenticated LeadMASTER administrator session cookie.

Request:

~~~json
{
  "messages": [
    { "role": "user", "content": "Summarize my latest inbox messages." }
  ]
}
~~~

Limits:
- Up to 12 messages.
- Up to 4,000 characters per message.
- Up to 14,000 UTF-8 bytes for the conversation.
- 20 requests per account per minute.
- Up to three model/tool rounds and four tool calls per request.

Success response:

~~~json
{
  "reply": "There are 2 active inbox messages...",
  "actions": [
    { "name": "get_inbox_overview", "status": "completed" }
  ],
  "prepared_email": null,
  "model": "@cf/meta/llama-3.3-70b-instruct-fp8-fast"
}
~~~

A prepared email response contains the recipient, subject and plain-text body with sent=false semantics. The dashboard opens it in Compose for review; the Assistant endpoint has no send-email tool.

Errors use HTTP 400 for invalid input, 401 for missing session, 403 for non-admin or invalid Origin, 413 for an oversized conversation, 429 for the account rate limit, and 503 when the AI or data service is unavailable.

## Privacy and operations

- Message contents sent to the model are processed by Cloudflare Workers AI under the account's Workers AI service terms and data-handling controls.
- Never include passwords, API keys, SMTP credentials, session cookies or login OTPs in prompts.
- The route logs only a bounded error code/reason and account identifier; it must not log message bodies, model prompts, tool results or authorization headers.
- The AI binding must be present. If unavailable, the route fails closed and the normal mailbox remains usable.
- Monitor inference usage and per-account request volume. Do not silently switch to a paid model or add an external AI provider.
- Any future write tool requires a separate server-side authorization, exact input validation, a human confirmation step, idempotency, audit record and negative account-isolation tests.

## Verification checklist

- Administrator session and same-origin enforcement.
- Invalid role, empty content, oversized message and oversized history rejection.
- Per-account rate limiting.
- Model tool-call parsing and bounded loop behavior.
- Mailbox queries constrained to the authenticated account's data.
- R2 message content decoded and truncated before inference.
- Email recipient must appear in a user-authored message before preparing a draft.
- No send, delete, archive, automation or settings mutation from the Assistant endpoint.
- Dashboard build, Worker bundle build, unit tests and browser tests.
