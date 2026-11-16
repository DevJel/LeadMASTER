# Delivery tracking and do-not-contact protection

**Status:** Signed delivery event ingestion and suppression handling are implemented. Webhook delivery events are a separate, narrower event contract.

## Delivery event flow

~~~mermaid
sequenceDiagram
  participant SES as Sending service
  participant SNS as Signed event notification
  participant Worker
  participant Dedupe as Event deduplication
  participant D1 as Mail and suppression records
  participant UI as Dashboard
  SES-->>SNS: Sent / delivered / bounce / complaint / delay / reject
  SNS->>Worker: Signed notification envelope
  Worker->>Worker: Validate signature, certificate and topic
  Worker->>Dedupe: Claim provider event ID
  Dedupe-->>Worker: New event or duplicate
  alt New event
    Worker->>D1: Correlate message and recipient
    Worker->>D1: Update delivery state and event ledger
    Worker->>D1: Add permanent bounce or complaint to suppression
    Worker->>D1: Write activity and notification
    D1-->>UI: Updated mailbox status
  else Duplicate
    Worker-->>SNS: Acknowledge duplicate without replaying side effects
  end
~~~

## User-visible status distinction

| Display state | Meaning |
|---|---|
| Queued | Stored for processing; not yet accepted by the sending service |
| Sending | Consumer currently processing the message |
| Sent / Accepted | Sending service accepted the submission |
| Delivered | Receiving mail server confirmed receipt |
| Delayed | Delivery is taking longer than expected |
| Could not deliver | Bounce or reject outcome |
| Marked as unwanted | Complaint outcome |
| Not sent | Definite local/transport failure |
| Needs checking | Final outcome could not be established |

Delivered does not guarantee inbox placement, display or reading.

## Suppression behavior

- Permanent hard bounces and complaints are added to the do-not-contact list.
- The outbound flow checks suppression before enqueueing/sending.
- Suppression records are a safety control, not ordinary disposable contacts. Do not add general delete controls that silently re-enable later sends.
- Delivery-event duplicates must be idempotent; replay must not duplicate activity, counters or suppression side effects.

## Source and tests

- SNS signature and event processing: `src/ses-sns-events.mjs`
- Message correlation: `src/ses-event-correlation.mjs`
- Suppression validation: `src/suppression-validation.mjs`
- Operational explanation: `docs/MAIL_WORKFLOW.md`
- Test coverage includes signature verification, event deduplication, recipient correlation, state transition and permanent suppression cases in `test/`.

## Limitations

Developer webhooks currently expose the submission outcomes `email.accepted`, `email.failed` and `email.unknown`. Do not claim every SES delivery event is mirrored to third-party webhook endpoints.
