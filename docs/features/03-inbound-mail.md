# Incoming mail and inbox

**Status:** Implemented for one dedicated receiving address. Separate attachment extraction and multiple mailbox provisioning are not available.

## Receiving flow

~~~mermaid
flowchart TD
  Sender[External sender] --> MX[Mail exchange routing]
  MX --> Exact[Exact-match dedicated recipient]
  Exact --> Inbound[Inbound email handler]
  Inbound --> Validate[Validate recipient and message size]
  Validate --> Original[Store original RFC email in object storage]
  Validate --> Metadata[Write searchable message metadata]
  Original --> Notification[Create inbox notification/activity]
  Metadata --> Notification
  Notification --> UI[Authenticated Inbox]
  UI --> Read[Fetch message detail / readable body]
  UI --> Download[Download original .eml]
~~~

The inbound handler accepts the dedicated address `app@leadmaster.jelvan.space`, applies a 25 MB message-size ceiling, stores the original email and its attached parts as one original message file, and records searchable headers/body metadata for the inbox. A failed durable store must not be acknowledged as a successfully stored message.

## User behavior

- Inbox is available only to an authenticated administrator.
- Opening a message retrieves its actual stored body and updates read state.
- The original message can be downloaded as `.eml`; attachments remain inside that original message.
- Message deletion is a soft-delete into Deleted. Restore is available before permanent cleanup.
- Permanent deletion requires explicit confirmation and is per-message; it must not clear queues, event history, suppression records, API keys, webhooks or audit history.

## Source and tests

- Recipient and size validation / persistence: `src/inbound-email-handler.mjs`
- Worker email entry: `worker.js`
- Dashboard message detail and actions: `required-componets-design/App.tsx`
- Original storage and metadata: the configured object storage and D1 bindings described in `docs/MAIL_WORKFLOW.md`
- Deletion claims / safe cleanup: `src/inbound-deletion.mjs`
- Tests: inbound handler, mailbox HTTP and deletion regression tests under `test/`

## Not available

There is no user-facing inbox provisioning API, custom forwarding-rule editor, or standalone attachment extraction/download feature. Do not imply other domains or addresses are being ingested by the dedicated mailbox.
