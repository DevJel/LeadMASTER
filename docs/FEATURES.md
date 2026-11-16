# LeadMASTER feature and system documentation

This is the engineering index for the implemented LeadMASTER product. Each feature guide records its user-visible purpose, current release status, source modules, endpoints or data contracts, control flow, and a Mermaid diagram. The code and tests are authoritative: when a diagram, old note, README statement or feature flag differs from the deployed source, update this index and the relevant guide in the same change.

## Product capability matrix

| Feature | Current status in source | Boundary |
|---|---|---|
| Public landing, Help Center and clean page URLs | Implemented | Worker maps clean browser paths to existing static HTML assets; old `.html` links redirect |
| Human administrator login | Implemented | Single configured administrator identity; password, Turnstile, email OTP and server session |
| Dashboard and six utility modules | Implemented | Shared responsive React UI with a unified inbox, centered search, responsive collapsible sidebar and bottom-anchored profile/settings; Notes, Contacts and Calendar persist as workspace records; Calculator, Currency Conversion and HTML Playground are client-side utilities |
| Inbox and incoming email | Implemented | One dedicated inbound address; original message retained; attachment extraction is not a separate feature |
| Sending and queue processing | Implemented | Immediate send queue, persistent per-message idempotency/rate reservations; no scheduled send engine |
| SES delivery events and suppression | Implemented | Signed event verification, deduplication, delivery status updates, permanent-bounce/complaint suppression |
| Developer Email API and API keys | Implemented | Account-scoped Bearer keys and scopes; API acceptance is not inbox delivery |
| Webhooks | Implemented with limitations | Account-owned endpoints and one-time signing secret; event dispatch currently makes a synchronous attempt; safe URL checks do not claim full DNS-rebinding/SSRF protection |
| Templates and HTML preview | Partial | Template create/list/insert exists; full edit/delete lifecycle is not a production capability; preview is browser-local and does not send or persist |
| AI reply suggestions | Implemented | User-triggered draft only; human review is required before sending |
| Activity, notifications and sound | Implemented while dashboard is open | Browser polling/audio/notifications are not background push |
| Workspace records | Implemented | Account-scoped collections, bounded payloads, idempotent create, owner-constrained replace/delete |
| Daily Reporter | Implemented in Worker source | Scheduled operational summary; optional control-plane inventory depends on separately configured read-only access |
| Strict Auto-Heal | Guarded/manual | May analyze a scoped failure and propose a narrowly validated change; it must not merge, deploy, mutate production data or bypass review |
| MCP | Experimental / not mounted in production | No public production MCP endpoint or send tool |
| Scheduled campaigns and workflow automation | Not available | No production scheduler/execution engine; UI must not imply a saved reminder automatically sends email |
| Team management / self-service registration | Not available | Current rollout supports one configured administrator identity |

**Deployment caution:** Source presence, green unit tests and a generated asset bundle do not by themselves prove a production deployment or an end-to-end provider delivery. Deployment and real inbox acceptance must be recorded separately in `CHANGELOG.md` and `HANDOVER.md`.

The proposed, not-yet-implemented conversation and persistent-attachment design is in [MAIL_THREADS_DESIGN.md](MAIL_THREADS_DESIGN.md).

## Feature guides

1. [Authentication, authorization and routing](features/01-authentication-and-routing.md)
2. [Dashboard shell and utilities](features/02-dashboard-and-utilities.md)
3. [Incoming mail and inbox](features/03-inbound-mail.md)
4. [Outgoing email, queue and sending coordinator](features/04-outbound-email-and-queue.md)
5. [Delivery tracking and suppression](features/05-delivery-events-and-suppression.md)
6. [Account API and API keys](features/06-account-api-and-keys.md)
7. [Webhooks](features/07-webhooks.md)
8. [Workspace records, templates and preview](features/08-workspace-records-templates-preview.md)
9. [AI reply assistance](features/09-ai-reply-assistance.md)
10. [Activity, notifications and sound](features/10-activity-notifications.md)
11. [Errors, privacy and security controls](features/11-errors-and-security.md)
12. [Daily Reporter and strict Auto-Heal](features/12-operations-and-auto-heal.md)
13. [MCP, automation and scheduling boundaries](features/13-mcp-automation-and-scheduling.md)
14. [Android, assets and release verification](features/14-android-assets-and-release.md)

## Cross-system architecture

~~~mermaid
flowchart TD
  Visitor[Public visitor] --> Public[Landing / Help Center]
  Admin[Configured administrator] --> Auth[Password + Turnstile + email OTP]
  Auth --> Session[Server-validated session]
  Session --> Dashboard[Responsive dashboard]
  Dashboard --> Mailbox[Inbox and mailbox actions]
  Dashboard --> Compose[Immediate-send composer]
  Dashboard --> Utilities[Notes / Contacts / Calendar / Calculator / Currency / HTML Playground]
  Dashboard --> APIKeys[Account API keys]
  APIKeys --> DevAPI[Account-scoped REST API]
  DevAPI --> Send[Same email-send service]
  Send --> Queue[Durable send queue]
  Queue --> Coordinator[Persistent idempotency and rate coordinator]
  Coordinator --> SES[Email transport]
  SES --> Delivery[Signed delivery events]
  Delivery --> Mailbox
  Delivery --> Suppression[Do-not-contact records]
  Inbound[Dedicated inbound address] --> Store[Original message storage + searchable metadata]
  Store --> Mailbox
  Dashboard --> AI[On-demand reply suggestion]
  AI --> Human[Human review and send]
  Human --> Queue
  Ops[Daily Reporter / strict Auto-Heal] --> Checks[Health checks and scoped diagnostics]
~~~

## Change protocol

For every feature change, update the feature guide, source map, tests and user-visible status in the same pull request. Identify the API routes, data ownership boundary, migrations, error behavior, queue/third-party connections and mobile implications. Add a Mermaid diagram for any new end-to-end feature. Do not write a feature as shipped unless its UI, API, persistence, security checks and release evidence all exist.
