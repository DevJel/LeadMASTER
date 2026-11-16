# MCP, workflow automation and scheduled sending

**Status:** MCP is experimental and not mounted in production. A production scheduler/workflow execution engine is not available.

## Current boundaries

~~~mermaid
flowchart TD
  Agent[External agent] --> REST[Supported account-scoped REST API]
  REST --> Auth[Account-bound key + scope checks]
  Auth --> Email[Email API / webhook management]
  UI[Dashboard] --> Saved[Saved reminders / rule records]
  Saved -. no execution scheduler .-> Boundary[No automatic send/action]
  MCP[MCP prototype source] -. not mounted .-> NoProd[No public production MCP endpoint]
~~~

## Supported now

- Server-to-server integrations use the documented account-scoped REST API.
- API keys are account-bound and least-privilege scopes are checked server-side.
- Workspace reminder/rule records may be stored as records; saving them does not schedule an action.
- Email API and webhook events represent the current supported integration surface.

## Not available as production capabilities

- Public MCP URL, production MCP email-send tool or broad MCP data access.
- Autonomous agent actions inside a human administrator session.
- Scheduled campaigns, recurring dispatch, calendar-triggered email or queue deferral by user-entered timestamp.
- General workflow builder, trigger engine, connector registry, durable automation execution history or retry controls.
- Self-service account signup, team invitations, multi-member roles and organization switching.

## Future implementation guardrails

Any future MCP or workflow runtime must derive account identity from its authenticated principal, invoke the same account-owned application service methods as REST, enforce scopes and idempotency, keep credentials outside the browser, produce audit events, and add negative cross-account tests. Scheduling must use durable state, timezone-aware next-run calculation, idempotent claims, cancellation and recovery from missed/duplicate triggers. Do not activate a UI-only control that appears to schedule email without a server execution engine.

## Source and documents

- Prototype source: `src/mcp-server.mjs`
- Worker route policy: `worker.js`
- MCP policy: `docs/MCP.md`
- Agent rules: `AGENTS.md`
