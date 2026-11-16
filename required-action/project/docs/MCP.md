# LeadMASTER MCP integration

## Status

The repository contains an experimental, read-only Model Context Protocol server implemented with the official MCP SDK and stateless Streamable HTTP transport.

**It is not mounted by the current production Worker and is not available as a public service.** There is no production MCP URL, client credential, OAuth registration or supported connection procedure. Do not connect to `https://leadmaster.jelvan.pro/mcp` or assume that route is enabled.

## Tools in the prototype

Only two tools are registered:

- `get_email_capabilities` — returns a static description of the experimental MCP capabilities. It is not a live service health check.
- `validate_email` — validates message shape and size against the queue input rules. It does not store, queue or send the message, verify recipient consent or sender identity, check quotas, or report delivery. The result does not echo message content.

The MCP implementation has no tools for sending email, campaigns, audiences, templates, delivery history, analytics or account administration. It makes no SMTP or AWS API calls.

## Protocol behavior in the source implementation

The handler uses stateless Streamable HTTP with JSON responses. It accepts POST requests with JSON content and enforces a 100 KB body limit. Unsupported methods and content types are rejected. These are implementation details for isolated testing, not a production service-level contract.

## Experimental configuration

The prototype fails closed unless:

- `MCP_EXPERIMENTAL_ENABLED` is set to `true`; and
- a separate `MCP_ACCESS_TOKEN` secret is bound.

The token must be a cryptographically random base64url string of 43–128 characters (at least 32 random bytes). It must never reuse administrator credentials, session-signing secrets, SES SMTP credentials or any email API key. If an Origin header is present, the prototype checks it against `MCP_ALLOWED_ORIGIN`.

This is bearer-token authentication, not OAuth. There is no client registration, per-client scopes, token issuance/rotation/revocation service or production rate limiting. Any holder can call all registered tools. Origin checking is not a replacement for authorization or CORS.

## Deployment and security gates

Before any public deployment, complete an isolated staging release, Workers runtime compatibility tests, client-level authorization, token lifecycle and revocation, abuse/rate controls, privacy-safe monitoring, independent security review and end-to-end tests. Confirm that tools cannot bypass authentication or email sending safeguards.

Any future email-send capability requires a separately reviewed public API, durable queue/outbox, idempotency, delivery events and operator reconciliation. It must not be implicitly exposed through MCP.

Local tests use mocked boundaries and do not prove Cloudflare deployment, authorization safety or email delivery.


## Relationship to the Developer Email API

The Developer Email API is a separate HTTPS integration for server-to-server application sending. Developers generate and revoke scoped credentials in the authenticated LeadMASTER workspace and use the REST endpoints documented in [API.md](./API.md). MCP clients must not treat a developer API key as an MCP access token. The current MCP server remains experimental and read-only; it does not expose email-send tools or bypass API-key scopes, idempotency, rate limits or audit records. Any future MCP send tool must call the same authorized email-submission service and receive a separate security review.


## Public documentation location

The public product and integration documentation is consolidated into the Documentation tab on the main landing page: [LeadMASTER documentation](https://leadmaster.jelvan.pro/#documentation). The legacy `/mcp.html` URL redirects to the MCP section of that landing page. This repository file remains the engineering source of truth for MCP implementation and release gates; it is not a separate public documentation destination.


## Agent integration policy

AI agents must not use the human administrator sign-in page, security challenge, password or email OTP. The supported agent integration is the LeadMASTER REST API with a least-privilege server-side API key. The canonical machine-readable guide is [`/llms.txt`](https://leadmaster.jelvan.pro/llms.txt). Do not publish or assume a production MCP endpoint until the MCP server is deployed, authenticated, monitored and acceptance-tested.


## Account isolation requirements for any future MCP release

No MCP endpoint is available in production. If MCP is implemented, it must be account-bound by design:

- Authenticate each client as a specific LeadMASTER account principal.
- Derive account identity from the authenticated principal; never trust an account ID passed as a tool argument to select data.
- Store MCP client credentials, revocation state, permissions and audit events per account.
- Route every tool through the same account-scoped service functions used by REST.
- Apply account and resource ownership predicates to every read, write, webhook operation and result.
- Never provide platform-wide, operator or cross-account MCP access. Do not reuse a global token.
- Include negative tests for cross-account resource enumeration, IDOR, prompt injection and account-context substitution.
- Do not publish an MCP URL or advertise a tool until all authentication, authorization, rate, audit, privacy and deployment acceptance gates pass.

The current prototype is not mounted, and its read-only tools are not a production integration. The account-scoped REST API remains the only supported agent integration.
