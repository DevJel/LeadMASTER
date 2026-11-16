# Saved audience groups — implementation draft

This is a backend foundation, not a released campaign feature. No dashboard uses these endpoints yet. It does not schedule or send messages, verify consent, synchronize suppressions, manage names, remove contacts, or offer a contact-list or group-delete interface. File parsing remains in the composer; extracted addresses can be submitted to this API only after the UI is wired. Do not advertise it as available until the full workflow is integrated and validated.

## API (admin session only)

All writes require a same-origin `Origin` and `application/json`. Data is scoped to the authenticated account. Responses are `no-store`. Unauthorized requests receive 401; a non-admin receives 403. Validation errors return 400; limits and duplicate names return 409; unavailable storage returns 503. Do not send secrets in examples or logs.

- `GET /api/admin/audience/groups`: list groups and membership counts.
- `POST /api/admin/audience/groups`: `{"name":"Customers"}` creates a group. Names are case-insensitively unique within an account.
- `GET /api/admin/audience/groups/{id}` or `.../{id}/members`: group and normalized email addresses.
- `POST /api/admin/audience/groups/{id}/members`: `{"emails":["one@example.test","two@example.test"]}`. Each value must be one conservative ASCII email address, not a raw CSV row or display name. The server validates, lowercases and deduplicates again; the UI should extract candidates from multi-file CSV/text and show a preview before calling. Up to 500 values per request.

Import returns `submitted`, `unique`, `duplicates`, `added`, `already_in_group`, and `not_added`. `not_added` indicates a group or account capacity limit. Existing contacts may be used in multiple groups. A partially full group may leave unused, account-owned contacts from the same import; these are not proof of consent. Repeating the same request is safe because contacts and memberships are unique. If a response is lost or returns 503 after a transaction may have committed, reload the group before presenting the result. Limits: 100 groups and 5,000 contacts per account, 500 members per group. These draft safety caps need product review before release.

## Security and release

A syntactically valid address is not evidence of consent or deliverability. Future campaign dispatch must verify permission and suppression at dispatch time, capture provenance/consent and provide any required unsubscribe mechanism. Never mix account data. Migration 0011 is additive but production application requires an approved rollout, backup/restore strategy and isolated staging rehearsal. Test actual D1 batch semantics, concurrent imports, authenticated Worker routing, browser UX and multi-file parsing before release. Avoid deploying the current consumer before the earlier 0009/0010 and queue-reconciliation gates. No production changes, real customer data or live mail were used for this draft.
