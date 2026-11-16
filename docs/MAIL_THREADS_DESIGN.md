# Mail conversations and attachments — proposed design

**Status: not implemented.** The current mailbox stores each received original message separately and each outgoing recipient as a separate send record. It does not yet offer a shared thread model, extracted attachment storage, attachment sending, or standards-compliant reply headers. Do not advertise this document as an available feature.

## Ownership and data model

All new tables and every read, join and mutation must be scoped by the authenticated account. The single configured mailbox and older rows have no reliable per-row account owner today. Before backfilling, explicitly establish and verify the owner; leave uncertain records inaccessible rather than guessing. A proposed additive schema is:

- `mail_threads`: `id`, `account_id`, `subject_display`, `subject_normalized`, `created_at`, `updated_at`; unique `(account_id,id)`.
- `mail_messages`: `id`, `account_id`, `thread_id`, `direction`, `rfc_message_id`, `in_reply_to`, `references_json`, `from_json`, `to_json`, `cc_json`, private `bcc_json`, `subject`, `text_body`, `html_object_key`, `original_object_key`, `read_at`, `created_at`, `send_status`, `delivery_status`, `error_code`, and `legacy_source/id`; unique `(account_id,id)` and scoped foreign key `(account_id,thread_id)`. RFC IDs are not authorization identifiers and can be malformed, missing or duplicated.
- `mail_attachments`: `id`, `account_id`, `message_id`, `object_key`, `filename`, `declared_media_type`, `size_bytes`, `checksum`, `disposition`, `content_id`, `created_at`, `storage_state`; unique `(account_id,id)` and scoped foreign key `(account_id,message_id)`. Object keys are private implementation details, not public storage URLs; a same-origin authenticated download endpoint verifies ownership on every request.

These are logical fields, not an applied migration. Use versioned additive migrations, indexes for account/thread/chronology, an explicit mapping from legacy records, and a tested rollback and backup plan. Never overwrite existing originals during a backfill. Represent parsing failures and missing originals explicitly; do not assert that old attachments are individually available. Set and document a retention policy: “permanent” cannot mean files survive an explicitly confirmed permanent deletion or retention rule.

## Threading and reply behavior

Extract bounded RFC message IDs and references using a tested MIME/RFC parser, normalizing folding safely. Match an authorized account's existing `References` and then `In-Reply-To` before considering a conservative subject-and-participant fallback; subject alone must never join unrelated conversations. Handle duplicate IDs, out-of-order arrivals, forwarding, missing/malformed headers, separate bulk recipients and BCC privacy. Order messages by a trusted received/created timestamp with a deterministic tie-breaker. A send creates a stable RFC `Message-ID` and includes validated `In-Reply-To` and `References` across API, database, queue, idempotency digest, coordinator and transport. `Re:` or `Fwd:` text alone is not proof of threading.

The shared Inbox/Sent thread detail must load all authorized history with pagination, preserve thread context after mutations and present read older messages as collapsible summaries. Reply, reply-all and forward need correct recipient selection, no leaked BCC, human confirmation, rich-text/plain alternatives, and a user-expandable quoted history. Resolve quoted body and attachment content from the authorized message, not client-supplied owner IDs.

## Attachments and previews

Persist incoming originals before acknowledging receipt; extract bounded MIME parts without losing originals. Upload outgoing files to private durable storage before accepting a send; bind each part to its owner and message, include it through the queue and actual MIME transport, then retain it under the documented policy. Enforce file count, decoded/encoded size, traversal-safe filenames, MIME sniffing, content disposition, malware policy, integrity, orphan cleanup and quota. Never trust a supplied URL or filename. Partial uploads and send failures need observable recovery and no broken references.

Serve downloads as attachments with `nosniff` and a sanitized filename. Preview HTML only with an opaque-origin sandbox, strict CSP, sanitized markup, disabled scripts, network, forms and active links; preview images/PDFs in isolated contexts with safe headers or offer download when isolation cannot be guaranteed. Do not render arbitrary HTML, SVG or PDF on the authenticated app origin. External resources are blocked by default to protect privacy.

## Failed and unknown sends

Track queue, acceptance and later delivery separately. `unknown` is not `failed`: reconcile ambiguous outcomes before retrying. A resend may be enabled only for a confirmed retryable failure, after re-reading a complete immutable original (recipients including authorized CC/BCC, headers, body, sender, attachments) and enforcing a server-side atomic idempotency/claim fence. Edit opens an editable copy; do not mutate the historical attempt. Delete requires confirmation and must respect send-in-progress, audit and storage cleanup. Preview must accurately state its limitations. No automatic bulk retry of active or unknown messages.

## Release gates

- Unit and integration tests for MIME encodings, mixed/nested attachments, large inputs, body fidelity, references, concurrency, idempotency, failure and rollback.
- Negative tests for cross-account reads/mutations/downloads, ID collisions, XSS, content sniffing, path traversal and remote tracking.
- Staging migration/backfill and rollback with synthetic data; real account acceptance using approved recipients only.
- Responsive desktop/mobile and Android WebView download/preview checks; production deployment and smoke checks recorded separately.
