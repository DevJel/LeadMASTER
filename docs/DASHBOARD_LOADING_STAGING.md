# Dashboard loading indicator — staged

The reusable TypeScript/React loading indicator translates the supplied Inbox reference into a gray-and-white accessible status, including reduced-motion support. It uses an indeterminate animation and a caller-supplied description; it does not imply a percentage or complete on a timer.

The staged SMTP settings panel uses it while loading the connection list and activity and while saving, removing, or testing a connection. A verification response must explicitly report `connected` before the panel announces success. API responses and loading states have been tested with synthetic fixtures only.

This is not the live dashboard. The component is not yet connected to the real Inbox or other application screens, and the SMTP panel and its API handlers remain unmounted. Before release, connect loading states to actual request lifecycles throughout the complete TSX dashboard, handle failures and accessibility, and validate the real backend, security, deployment and Android release. Do not treat the preview or test fixtures as production data.
