# Experimental read-only MCP integration

Status: repository implementation only, disabled by default. Not production-ready and not present in the static preview Worker. This is not an email-sending MCP service.

The Streamable HTTP server uses the official MCP SDK, is stateless, and exposes only `get_email_capabilities` and `validate_email`. Validation applies the queue's input rules and size limit; it does not store, queue, send, validate consent, confirm sender identity or check delivery. No SMTP or AWS API call is made by the MCP tools. Results do not echo the message.

## Security and configuration

The `/mcp` route fails closed with 503 unless `MCP_EXPERIMENTAL_ENABLED` is `true` and a separate `MCP_ACCESS_TOKEN` secret is bound. The token must be a cryptographically random base64url string of at least 43 characters (at least 32 random bytes); never reuse an SES or email API credential. Keep tokens out of client-side code, logs, URLs and version control. Bearer authentication is supported for testing with a trusted client. This is **not OAuth**: there is no discovery, per-client authorization, scoped token issuance, rotation or revocation service. Any holder can call every exposed tool. An Origin header, if present, must exactly match `MCP_ALLOWED_ORIGIN`; this does not provide CORS or browser authorization. Requests and results should be treated as untrusted data.

These controls are not a production authorization solution. Do not expose the endpoint publicly or connect third-party assistants before the OAuth/resource-server design, abuse/rate limiting, monitoring, privacy and independent security review are complete. The current public Worker does not have this route or its secrets bound. No live endpoint is advertised.

## Deployment prerequisites

Build Worker dependencies with the lockfile, validate Workers runtime compatibility and deploy to an isolated staging environment first. Configure all runtime bindings explicitly; never place secret values in config files. Verify authorization, Origin handling, payload limits and SDK compatibility in the target Worker runtime. Separately complete authentication, safe durable email acceptance/recovery, SES sender and quota verification, and abuse controls before any email-sending tool is considered. Sending must use the existing SES SMTP queue path only. A webhook integration would need its own verified implementation and must not be presented as available until tested.

Run local checks with `npm ci --ignore-scripts` followed by `npm test`. Tests simulate boundaries and do not establish Cloudflare deployment, SMTP delivery or production readiness.
