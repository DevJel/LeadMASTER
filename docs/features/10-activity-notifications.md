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
  UI --> Sound[User-enabled browser audio]
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
- Browser sound begins only after browser user interaction and only when the user has not disabled it.
- Device notifications require permission and an open supported browser context.
- No Web Push service worker subscription is configured for guaranteed notifications while the dashboard is closed.

## Source and tests

- Activity and notification route handlers in `worker.js`
- SES event side effects in `src/ses-sns-events.mjs`
- Dashboard state/notification UI in `required-componets-design/App.tsx`
- Activity tests and dashboard screenshots under `test/` and `scripts/capture-screenshots.mjs`
