# Full-page composer and Campaigns navigation

The existing modal is replaced by a full-page composer within the authenticated dashboard. It uses the existing `POST /api/admin/send` for immediate plain-text messages, with the same From choices, display name, subject and up to 500 manually entered recipients. During a request the send control is disabled. An uncertain server or network error warns against resending and disables that control until the panel is closed. The panel warns before discarding edited content. This does not provide durable drafts or guarantee idempotency across a new submission.

The navigation label is now **Campaigns**, but the current screen still shows recent accepted sends and the existing immediate-send action. Saved campaigns, groups, CSV import, scheduling, HTML and attachments are **not implemented**. Do not advertise them as live until their backend, persistence, UI and acceptance tests exist. Queue acceptance is not proof of inbox delivery.

The dashboard source and public mirror must remain identical; `npm run build:assets` regenerates the Worker asset bundle. Desktop and mobile screenshot capture includes the composer. Test authenticated dashboard access, all entry points and Android WebView navigation in isolated staging before a separate production release approval. No login settings or SES credentials are changed.
