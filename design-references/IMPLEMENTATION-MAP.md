# LeadMASTER Design Reference → Production Implementation Map

**Authority:** `design-references/` on `main`  
**Implementation target:** the canonical production dashboard in `src/Mandatory LeadMASTER Dashboard.html`, Worker/API routes in `worker.js` and `src/`, plus the shared Android WebView experience.  
**Working branch:** `integration/leadmaster-readme-first-2026-11-16`

This map makes the design-reference folder the visual and interaction source of truth. Production code must reproduce the supplied layouts, hierarchy, spacing, responsive behavior, states, illustrations, and animations—not merely approximate the screenshots or replace the existing product with a prototype. Existing production workflows and real data contracts must be preserved.

## 1. Reference inventory

| Reference | Role | Production mapping | Fidelity / acceptance requirement |
|---|---|---|---|
| `App.tsx` | Full application interaction and visual blueprint (mail shell, navigation, inbox, message detail, compose, outbox, templates, automation, assistant, scheduled mail, settings, workspace panel, contacts, calendar, reminders, notes, responsive states) | `src/Mandatory LeadMASTER Dashboard.html` and its mounted dashboard modules | Treat as the canonical screen-by-screen specification. Port all intended user-visible components and interactions; do not ship its SAMPLE/demo records or simulated actions as real account data or successful sends. |
| `index.css` | Design tokens, base styles, theme behavior, typography, scrollbar, shadow, tab and motion primitives | Dashboard stylesheet / component tokens | Preserve the reference’s neutral monochrome visual language and light/dark values; map tokens into the existing app without breaking contrast or existing supported themes. |
| `inbox-loading-reference.html` | Branded inbox loading illustration: building → envelope → person, animated dots and progress bar | Dashboard initial load, inbox/mailbox loading, mailbox refresh and empty-data transition | Use the supplied animation geometry and motion as the reference. Loading must reflect actual pending work, stop on success/error, and respect reduced-motion preferences. |
| `sending-animation-reference.html` | Horizontal sender → flight path → recipient-building animation; queued/sending/delivered steps | Compose send action, queue state, outbox row/detail and delivery result | Use the supplied horizontal composition and step styling. Advance only from real queue/provider events. Never show Delivered/green success from a timer or optimistic UI. |
| `illustrations/empty-mail.webp` | Empty mail state illustration | Empty inbox, sent, outbox or mail list state where semantically appropriate | Use the actual asset; preserve aspect ratio and avoid cropping/distortion. |
| `illustrations/empty-contacts.webp` | Empty contacts state illustration | Workspace Contacts panel and any full Contacts view | Use the actual asset; preserve aspect ratio and avoid cropping/distortion. |

## 2. Application screen and feature map from App.tsx

| Reference screen / feature | Expected production destination | Required behavior |
|---|---|---|
| Global app shell, top bar, navigation rail/sidebar, mobile sidebar | Main dashboard shell | Responsive desktop/tablet/mobile layout; navigation state and collapse behavior; no dead controls. |
| Inbox categories: Primary, Promotions, Social, Updates, Forums | Inbox list and category filters | Category selection, unread counts, search, filters, attachment filter, selection and refresh must use the authenticated account's mailbox records. |
| Message list and message detail | Inbox/message views | Open/read state, star, archive, snooze, delete/restore, permanent delete, bulk actions, safe HTML preview, reply and forward. |
| Compose tab and recipient chips | Compose view | Validate recipients; To/Cc/Bcc; subject/body; reply/forward/draft; preserve drafts; real send and scheduled-send API lifecycle. |
| Compose rich-text/HTML tools | Compose editor | Formatting, font/size/color/alignment, links, images, snippets, signatures, canned responses, tables, code, quote, divider, undo/redo, preview and source/HTML controls. Sanitize untrusted HTML and validate URLs; no script execution. |
| Sent | Sent mail view | Only provider-accepted/sent records for the current account; show actual timestamps and sender identity. |
| Outbox | Queue/outbox view | Real queue states Queued/Sending/Sent/Failed; retry and cancel only where backend state permits; expose provider error safely; green only for confirmed success and red for confirmed failure. |
| Templates | Templates tab | List, search/filter, preview, create, edit, save, duplicate and delete; persistent account-scoped CRUD; applying a template populates compose without silently sending. |
| Automation / rules | Automation tab | Rule CRUD, enable/disable, trigger and action configuration; backend execution status and audit history; never imply a rule ran unless the Worker confirms it. |
| Assistant | Assistant tab | Summary, draft suggestions, cleanup and priority workflows; clearly distinguish AI suggestions from executed mailbox mutations; require confirmation for destructive actions. |
| Scheduled | Scheduled mail view | Create, edit, reschedule, send-now and cancel; persist schedule and timezone; queue worker is authoritative for execution. |
| Settings | Settings tab | Profile, sender identity, signature, notification preferences, reply behavior, vacation responder, density and theme; persist only supported settings and report save failures. |
| Component organizer | Settings/navigation organizer | Reorder, hide/show, reset and save; persist per user/account; ensure hidden components remain reachable through a safe reset path. |
| Sender profile / contact detail | Sender profile panel | Sender identity, company/contact metadata, notes, view-all-from-sender, add contact and compose actions. Never infer a verified sender identity from a display name alone. |
| Workspace right panel | Right-side workspace panel | Contacts, calendar/reminders and notes panels; collapsible and responsive; retain state and keyboard accessibility. |
| Contacts | Workspace Contacts | Search, add, edit/delete as supported; account-scoped persistence; empty state uses `empty-contacts.webp`. |
| Calendar and reminders | Workspace calendar/reminders | Month navigation, date selection, add/toggle/delete reminder; persisted dates and timezone-aware display. |
| Notes | Workspace notes | Create/edit/delete, pin/unpin and persist; account isolation. |
| Loading/error/empty states | All applicable views | Reuse reference loading animation for real loads; provide retry and actionable error states; use relevant empty illustrations rather than demo rows. |
| Light/dark theme and density | Global dashboard settings | Token-based themes; verify readable text, controls, borders, selected states and contrast in both modes. |
| Responsive/mobile behavior | Shared web dashboard and Android WebView | No clipped panels or inaccessible actions; mobile sidebar and compose behavior; preserve the same backend/API behavior as web. |

## 3. Visual implementation rules

1. **Use the reference assets directly.** Do not redraw the loading/sending illustrations with unrelated icons or substitute generic stock imagery.
2. **Match the source hierarchy.** Keep the app shell, sidebar, content surface, mail list/detail, compose layout, and workspace panel in the same structural relationship as the reference.
3. **Preserve spacing and sizing.** Port measured widths, padding, gaps, border radii, typography scale, icon stroke/size, shadows, and responsive breakpoints from the reference rather than inventing a new visual system.
4. **Keep motion semantically truthful.** Animation may communicate a real pending operation; it must never fabricate progress, delivery, success, or failure.
5. **Respect reduced motion.** All animated states need a reduced-motion fallback matching the supplied references.
6. **Use real assets and safe rendering.** Keep the two WebP illustrations intact; sanitize message HTML; do not execute scripts or load arbitrary unsafe resources.
7. **Do not regress current production behavior.** Integrate the design into the canonical dashboard, not as a disconnected prototype or a replacement that drops existing working workflows.

## 4. Data and API binding rules

The visual reference contains sample records and local/demo interactions. Those are layout fixtures only. Production must bind each feature to authenticated, account-scoped Worker APIs and durable storage.

| Data domain | Required source of truth | Non-negotiable rule |
|---|---|---|
| Mailbox messages, sent, drafts, outbox | Authenticated mailbox/message API and queue | No sample messages in production; sent state is based on provider/queue result. |
| Templates | Templates API + persistent store | CRUD is scoped to the current account; preview is non-sending. |
| Rules/automation | Rules API + execution records | A saved rule is not proof of execution. |
| Scheduled mail | Schedule API + scheduled queue | Store timezone and execution state; no local-only timer. |
| SMTP sender configuration | Authenticated SMTP settings API + encrypted secret store | Never return credentials; validate host/port/TLS and protect against SSRF and DNS rebinding before network connection. |
| SMTP verification | Isolated, restricted verification/probe service | No arbitrary unauthenticated host probing; do not claim verified until a real TLS/auth test succeeds. |
| Contacts, reminders, notes, preferences | Authenticated records API | Enforce tenant/account ownership on every read/write. |
| Activity and delivery status | Worker/provider event records | Only LeadMASTER-originated activity; record event source, account, message ID, timestamps and normalized outcome. |

## 5. Implementation status checklist

This section is deliberately not marked complete by virtue of the reference existing.

- [ ] Inventory every visible component and interaction in `App.tsx` against the production dashboard.
- [ ] Integrate the complete layout and component hierarchy into the canonical production dashboard.
- [ ] Port design tokens and responsive behavior from `index.css`.
- [ ] Mount the inbox loading animation and bind it to actual load/refresh states.
- [ ] Mount the sending animation and bind its stages to actual queue/provider events.
- [ ] Use both supplied empty-state illustrations in their mapped states.
- [ ] Replace all production-facing SAMPLE/fixture content and simulated send/retry/schedule behavior with real APIs.
- [ ] Complete authenticated, account-scoped APIs and storage for all mapped features.
- [ ] Complete safe SMTP configuration, secret storage, verification, and transport security before enabling SMTP send.
- [ ] Implement truthful sent/failed states, retry/cancel semantics, and account-scoped activity monitoring.
- [ ] Ensure sender icons are based on safe, validated sender/domain metadata and never arbitrary remote image URLs.
- [ ] Verify web and Android WebView parity at phone, tablet and desktop widths.
- [ ] Run lint/typecheck/unit/integration/build tests and isolated staging acceptance tests.
- [ ] Open one consolidated PR with screenshots, test evidence, migration notes and explicit unresolved items.
- [ ] Do not deploy to production until review and staging acceptance pass.

## 6. Acceptance criteria

The implementation is accepted only when the production dashboard visually matches the supplied reference across all mapped screens and responsive states; all controls work against real authenticated APIs; account isolation is tested; loading and sending animations reflect real events; empty states use the supplied illustrations; no demo fixtures or fake success states leak into production; SMTP security tests pass; Android WebView parity is verified; and CI plus isolated staging checks pass.

**No “100% complete” claim is valid while any checklist item above remains unchecked.**
