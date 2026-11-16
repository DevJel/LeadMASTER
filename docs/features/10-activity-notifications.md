# Activity, notifications and sound

**Status:** Implemented for the authenticated dashboard while it is open. Background push delivery after the dashboard closes is not configured.

## Event flow

~~~mermaid
flowchart TD
  Action[Login / mailbox action / send / delivery update / profile change] --> Event[Worker records activity]
  Event --> ActivityDB[Workspace activity history]
  Event --> NotificationDB[Notification record when applicable]
  Dashboard[Open dashboard] --> Poll[Refresh active workspace data]
  Poll --> ActivityDB
  Poll --> NotificationDB
  NotificationDB --> UI[Notification list / unread state]
  Poll --> Sound[User-enabled foreground sound cues]
  UI --> Device[Browser notification permission]
~~~

## Event examples

- Sign-in and sign-out
- Incoming message
- Message enqueue/acceptance outcome
- SES delivery-state update
- Mailbox move, restore or permanent deletion
- Profile change
- AI reply suggestion
- Do-not-contact update
- Notification viewed

Activity history is an audit/readback surface. Do not add ordinary delete controls to activity. A successful UI toast must correspond to a successful server action; uncertain outcomes must be displayed as uncertain and reloaded from authoritative server state.

## Client behavior

- Polling and refresh must be silent during routine background refresh; do not replace the full page with a blocking loading screen.
- Poll while the dashboard is visible; pause work when the page is hidden and clean up timers/listeners on unmount.
- The Settings → Sounds preference enables distinct foreground cues after user interaction: new inbound mail, a message accepted by the sending service, or a confirmed deletion. Queueing, failure and uncertain results do not trigger a success sound. Acceptance is not proof of inbox delivery. The first snapshot establishes a silent baseline; duplicate and restored old messages do not replay. Sound is off by default.
- Android uses the same dashboard audio; its foreground native notification cards are silent to avoid duplicate and premature cues. Sound requires an open, visible workspace, device volume, and browser/WebView audio permission. No background push is provided.
- Device notifications require permission and an open supported browser context.
- No Web Push service worker subscription is configured for guaranteed notifications while the dashboard is closed.

## Source and tests

- Activity and notification route handlers in `worker.js`
- SES event side effects in `src/ses-sns-events.mjs`
- Dashboard state/notification UI in `required-componets-design/App.tsx`
- Activity tests and dashboard screenshots under `test/` and `scripts/capture-screenshots.mjs`
