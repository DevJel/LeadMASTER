# SMTP settings UI — staged, not release-ready

The TypeScript component in `src/dashboard-tsx` is unmounted. It is a proposed settings panel, not the requested dashboard redesign. It calls the separately staged `/api/admin/smtp` handlers, which are also unmounted. Do not expose the panel or deploy the handlers as-is.

The form captures name, sender email, hostname, username, password, and either STARTTLS/587 or TLS/465; it shows verification status and has a test button for the unmounted, fail-closed test handler. It does not create a working sender, send messages, perform a real SMTP test in production, or provide sender selection. Connection secrets are never stored in browser storage. Activity is scoped to the selected sender and represents LeadMASTER submissions only; SMTP acceptance does not indicate delivery. In-flight results are invalidated when the selected sender changes.

Before any release: integrate and test a real TSX build pipeline and the complete requested dashboard; establish an SSRF-safe network boundary and TLS verification; securely provision and rotate encryption keys; wire authorized settings, verification, queue and sending flows with account isolation and idempotency; verify monitoring against real LeadMASTER activity; then run security review, end-to-end and accessibility tests, Cloudflare deployment verification, and signed Android release/device checks. The migrations and SMTP modules must not be deployed until those requirements are satisfied.

The component was strictly type-checked and previewed in an isolated local fixture using synthetic data; the fixture is not part of the product. It has not been exercised against the production backend or a real SMTP server.

A pinned TypeScript/React/esbuild toolchain now checks the staged component in CI using `npm run check:dashboard`. This is a validation-only in-memory bundle, not a mounted dashboard or deployment artifact. API-client tests use synthetic responses and never send real mail.
