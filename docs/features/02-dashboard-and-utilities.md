# Dashboard shell and utility applications

**Status:** Shared responsive dashboard and utility launcher are implemented in source. Utility data features use authenticated workspace-record APIs. Currency conversion depends on a real quote source; the UI must not invent rates. HTML Playground is a browser utility, not a sending service.

## Dashboard shell

The dashboard is built as a single React workspace. Desktop layout keeps the application frame fixed to the viewport while the active workspace region scrolls independently. Mobile navigation adapts to a smaller viewport. The header profile control provides account identity and logout; the Apps launcher opens utility modules in their dedicated dashboard context.

~~~mermaid
flowchart TD
  Route[/dashboard?app=...] --> Session[Validate administrator session]
  Session --> Asset[Serve canonical dashboard HTML]
  Asset --> React[Mount React workspace]
  React --> State[Load authenticated account and mailbox data]
  React --> Shell[Header / sidebar / responsive navigation]
  Shell --> Active[Active content region]
  Active --> Inbox[Inbox / Sent / Deleted]
  Active --> Other[Assistant / Templates / Settings]
  Shell --> Launcher[Apps launcher]
  Launcher --> Utilities[Six utility modules]
  Utilities --> Notes[Notes]
  Utilities --> Contacts[Contacts]
  Utilities --> Calendar[Calendar]
  Utilities --> Calculator[Calculator]
  Utilities --> Currency[Currency conversion]
  Utilities --> HTML[Email HTML Playground]
~~~

## Utility inventory

| Utility | Logic | Persistence / side effects |
|---|---|---|
| Notes | Create, edit, pin, search and remove a note | `leadmaster_notes` workspace collection |
| Contacts | Create, edit, search and remove a contact | `leadmaster_contacts` workspace collection |
| Calendar | Create/edit reminders and mark them complete | `leadmaster_reminders` workspace collection; a reminder is not an automatic email schedule |
| Calculator | Parse and evaluate a restricted arithmetic expression | Browser-local; no server write |
| Currency Conversion | Validate a source/destination pair, request a quote and calculate a converted amount | Must use a real quote/provider or an explicitly disclosed cached quote; never present a guessed rate |
| Email HTML Playground | Compose/edit HTML, sanitize preview output and export the result | Browser-local export; does not send or create a persisted template unless the separate template API is used |

## Workspace interaction boundaries

- Every saved record action goes through the same authenticated `/api/workspace/actions` route and current account session.
- UI optimistic state must reconcile with the response; an optimistic display is not proof of persistence.
- Errors are mapped to customer-friendly messages; raw SQL, provider errors and stack traces must not be shown.
- Apps deep links retain the selected module through the `app` query parameter.
- New-tab launcher entries must use explicit `target="_blank"` and `rel="noopener noreferrer"` where an external destination is genuinely intended. Internal utility modules remain inside the dashboard and do not fabricate external app URLs.

## Source and tests

- Dashboard: `required-componets-design/App.tsx`
- Utility modules: `required-componets-design/UtilityApps.tsx`
- Shared palette/shell CSS: `required-componets-design/index.css`
- Workspace record API: `src/leadmaster-records-api.mjs`
- Build and screenshots: `scripts/build-static-assets.mjs`, `scripts/capture-screenshots.mjs`
- Dashboard tests: `test/dashboard.test.mjs`, utility/record tests in `test/*records*.test.mjs`

## Not implemented

A calendar reminder is a saved reminder, not a scheduler that automatically sends email. Calculator and HTML Playground do not write backend records by themselves. Currency conversion is not allowed to fabricate rates when the quote source is unavailable.
