# LeadMASTER Mail Workflow

This document describes the production email workflow deployed for LeadMASTER. User-facing dashboard labels use plain language; this document records the underlying services and operating boundaries.

## Production components

| Component | Responsibility |
|---|---|
| LeadMASTER Worker | Login, account ownership, dashboard routes, message actions, sending requests, activity and notification APIs |
| D1 database | Message details, send status, account settings, activity history, notifications and do-not-contact records |
| R2 bucket | Original incoming email files, including their attached files |
| Cloudflare Email Routing | Receives mail addressed to the dedicated LeadMASTER inbox |
| Inbound email Worker | Stores each message in R2 and records its details in D1 |
| Cloudflare Queue | Holds outgoing messages until they can be sent |
| Queue consumer Worker | Sends queued messages through AWS SES SMTP and records the result |
| Failed-message queue | Holds messages that exhaust retries |
| Failed-message consumer | Marks exhausted messages as not sent and adds an activity/notification record |
| AWS SES configuration set | Publishes sending and delivery events |
| AWS SNS | Delivers signed SES events to the LeadMASTER event endpoint |
| Workers AI | Prepares a reply suggestion when the administrator requests one |

## 1. Incoming mail

The dedicated receiving address is:

**inbound@inbound.leadmaster.jelvan.pro**

~~~mermaid
flowchart TD
  A[Sender emails the dedicated LeadMASTER address] --> B[Cloudflare MX records]
  B --> C[Exact-match Email Routing rule]
  C --> D[LeadMASTER inbound email Worker]
  D --> E[Save original email in R2]
  D --> F[Save sender, recipient, subject and date in D1]
  E --> G[Create new-message notification]
  F --> G
  G --> H[Superadmin Inbox]
  G --> I[Activity history]
~~~

The Email Routing rule matches only the dedicated address. It does not replace, disable or redirect any existing forwarding rules for jelvan.pro, leadmaster.jelvan.pro or operavaglobal.com.

The original email file is retained in R2. The dashboard displays readable text and provides a download of the original .eml file. Attached files remain inside that original email; separate attachment extraction and individual attachment downloads are not currently implemented.

Messages larger than 25 MB are rejected by the inbound Worker. If R2 or D1 storage fails, the message is rejected rather than silently acknowledged as stored.

## 2. Outgoing mail

Dashboard messages and account API messages use AWS SES SMTP. The dashboard can queue up to 500 unique recipients in one request. The account API continues to accept one recipient per request.

~~~mermaid
sequenceDiagram
  participant U as Superadmin or account API
  participant W as LeadMASTER Worker
  participant D as D1
  participant Q as Sending queue
  participant C as Queue consumer
  participant S as AWS SES SMTP
  U->>W: Submit message and recipient
  W->>W: Check access, address, content and do-not-contact list
  W->>D: Record message and queue status
  W->>Q: Add message to queue
  W-->>U: Confirm message was queued
  Q->>C: Deliver up to 10 messages per batch
  C->>S: Submit through SMTP
  S-->>C: Accepted or not accepted
  C->>D: Update sending result and activity
  C-->>Q: Acknowledge or retry
~~~

### Sending pace

The production queue has:

- One active consumer.
- A batch size of up to 10 messages.
- A 100 ms pause between consecutive messages.
- Up to three queue attempts for a message before it is marked unsuccessful.
- A separate failed-message queue and consumer for exhausted queue messages.

This limits queue-driven sending to no more than 10 messages per second. Actual sending may be slower because each SMTP submission takes time. The rate is a LeadMASTER queue limit, not a promise that AWS SES will accept every message.

Login verification codes and new-login security notices use the same SES SMTP service and branded system sender, but bypass the bulk queue so sign-in does not wait behind a campaign.

## 3. Sender identity

| Message type | Sender display | Reply-To |
|---|---|---|
| Login code and security notice | LeadMASTER | Not changed to a personal address |
| Superadmin message from work address | Jelvan Ricolcol | Registered superadmin email |
| Superadmin message from Operava | Operava | Registered superadmin email |
| Other superadmin verified address | Selected display name | Registered superadmin email |
| Regular account API message | Account holder's full name | Registered account email |

The system sender is noreply@leadmaster.jelvan.pro. Superadmin sender choices are restricted to the verified LeadMASTER identities under jelvan.pro and operavaglobal.com. Regular API senders are generated from the account holder's name under leadmaster.jelvan.pro. API users may provide sender_name to set or update the name stored on their account.

SMTP host, username and password are read from Cloudflare Secrets Store. They are not sent to the browser or returned by the API.

## 4. AWS SES delivery updates

LeadMASTER uses a separate AWS SES configuration set named leadmaster-events. The SMTP message includes the configuration-set header and a LeadMASTER message reference. SES publishes events to a dedicated SNS topic; SNS sends signed notifications to:

https://leadmaster.jelvan.pro/api/aws/ses-events

~~~mermaid
flowchart TD
  A[LeadMASTER sends through SES SMTP] --> B[SES configuration set]
  B --> C[SES event destination]
  C --> D[SNS signed notification]
  D --> E[Verify SNS signature and topic]
  E --> F[Prevent duplicate event processing]
  F --> G[Save delivery event in D1]
  G --> H[Update message status]
  G --> I[Create activity entry]
  G --> J[Create dashboard notification]
  G --> K[Add permanent bounces and complaints to Do Not Contact]
~~~

Tracked event types include sending, delivery, bounce, complaint, delay, rejection, rendering failure and subscription events. The dashboard uses everyday labels such as **Sent**, **Delivered**, **Delayed**, **Could not deliver**, **Marked as unwanted** and **Not sent**.

- **Sent** means SES accepted the SMTP submission.
- **Delivered** means the recipient's mail service confirmed receipt.
- Neither status guarantees inbox placement, display or reading.
- A permanent bounce or complaint is added to the do-not-contact list.
- Future sends to a listed address are skipped.

The account API exposes the request status and delivery status separately. Developer webhooks currently report submission outcomes (email.accepted, email.failed, email.unknown); SES delivery events are shown in the superadmin dashboard.

## 5. AI reply suggestions

AI assistance runs only when the superadmin selects **Suggest a reply** on an incoming message.

~~~mermaid
flowchart TD
  A[Superadmin opens an incoming email] --> B[Select Suggest a reply]
  B --> C[Load current email]
  C --> D[Find related sent messages]
  C --> E[Find related received messages]
  D --> F[Prepare limited conversation context]
  E --> F
  F --> G[Workers AI drafts a reply]
  G --> H[Show editable suggestion]
  H --> I[Superadmin reviews and edits]
  I --> J[Superadmin confirms sending]
  J --> K[Sending queue]
~~~

The reply assistant uses the current email and up to five related sent and five related received messages when available. If no useful history is found, it drafts from the current message alone. Email contents are treated as untrusted material; instructions inside an email cannot authorize the assistant to reveal secrets, change system rules or perform actions. AI suggestions are never sent automatically.

## 6. Activity, notifications and sounds

The activity history records important account and message actions, including:

- Sign-in code requests, successful sign-ins and sign-outs.
- Incoming messages.
- Messages added to the sending list and accepted by SES.
- SES delivery status changes.
- Messages marked read or unread, archived, restored, moved to Deleted or permanently deleted.
- Account name changes and reply suggestions.
- Contact addresses marked Do not contact.
- Notifications viewed.

The dashboard checks for new notifications while it is open. It plays separate LeadMASTER tones for incoming messages, sent messages, deletions and confirmations. Device notifications can be enabled by the user.

Sound and browser notifications require the dashboard to be open and the browser to allow notifications/audio. Background push when the dashboard is closed is not configured. On iOS, browser notification support may require the web app to be added to the Home Screen and permission granted.

## 7. Message folders

| Folder | What it contains |
|---|---|
| Inbox | New incoming messages |
| Archived | Messages removed from the Inbox without deleting them |
| Sent | Messages accepted by SES or still being processed |
| Bounced | Messages that could not be delivered or were reported as unwanted |
| Unsuccessful | Messages that could not be sent or whose result needs checking |
| Deleted | Soft-deleted incoming and outgoing messages |
| Unsubscribed | Addresses marked Do not contact |

Deleted messages can be restored. Permanent deletion removes the stored original email file and its database record. Addresses on the do-not-contact list are skipped by dashboard and account API sends. The Unsubscribed folder records complaints, permanent bounces and manual entries; a public marketing unsubscribe page is not part of this release.

## 8. Security and privacy boundaries

- All mailbox, message, activity, notification and sender-management routes require the configured superadmin session.
- API sending requires a valid account-owned API key, matching account ID, the email:send scope, idempotency and per-key rate checks.
- Sender domains are restricted to verified SES identities.
- Incoming original messages are stored in a dedicated R2 bucket; metadata and activity are stored in D1.
- SNS delivery notifications are accepted only after signature and topic validation.
- Email body text is displayed as text, not executed as HTML.
- SMTP credentials remain in Cloudflare Secrets Store.
- Message contents, passwords, OTPs, API keys and SMTP credentials must not be written to ordinary application logs.

## 9. Production configuration checklist

| Resource | Production name or purpose |
|---|---|
| Main Worker | leadmaster |
| Inbound email Worker | leadmaster-inbound-mail |
| Sending queue | leadmaster-mail-send |
| Failed-message queue | leadmaster-mail-send-failed |
| Queue consumer | leadmaster-mail-queue-consumer |
| Failed-message consumer | leadmaster-mail-failed-consumer |
| D1 database | leadmaster-auth |
| R2 bucket | leadmaster-inbound-mail |
| SES region | ap-southeast-2 |
| SES configuration set | leadmaster-events |
| Dedicated inbox | inbound@inbound.leadmaster.jelvan.pro |

All SMTP credentials remain in Cloudflare Secrets Store. The dedicated inbound rule is separate from existing personal and Operava email-routing rules.


## Pending branch: recoverable inbound deletion (not deployed)

Migration 0008 adds a durable claim to already-soft-deleted inbound records. Restore is rejected once cleanup has been claimed. If R2 or D1 cleanup fails, a retry is required; an error does not prove the original object remains. Monitor pending deletion claims and verify them in staging before rollout. This does not yet implement the required typed confirmation UI.
