# Dashboard loading indicator — staged

The reusable TypeScript/React loading indicator translates the supplied Inbox reference into a gray-and-white accessible status, including reduced-motion support. It uses an indeterminate animation and a caller-supplied description; it does not imply a percentage or complete on a timer.

The staged SMTP settings panel uses it while loading the connection list and activity and while saving, removing, or testing a connection. A verification response must explicitly report `connected` before the panel announces success. API responses and loading states have been tested with synthetic fixtures only.

This is not the live dashboard. The component is not yet connected to the real Inbox or other application screens, and the SMTP panel and its API handlers remain unmounted. Before release, connect loading states to actual request lifecycles throughout the complete TSX dashboard, handle failures and accessibility, and validate the real backend, security, deployment and Android release. Do not treat the preview or test fixtures as production data.

## Sending animation

`SendingIndicator.tsx` recreates the supplied person-to-building flight illustration in the gray-and-white theme. Its phase is an explicit input, not an automatically advancing timer: callers must derive it from the real submission request and authoritative account-scoped status records. Submitting is indeterminate; queued or accepted is not delivery. A failed or uncertain outcome does not animate or report success, and the uncertain state warns against resending until checked. Reduced-motion users get a static illustration.

This component is not connected to the real composer or queue and does not send, poll, or change any mail. Integrating it requires matching each actual backend result, handling mixed batch outcomes and ambiguous submissions without retrying, and verifying the full authenticated workflow before deployment. Local tests and visual previews use synthetic data only.
