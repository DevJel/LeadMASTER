# Cloudflare Secrets Store binding review

**Status: reference mapping only; not deployed.** This file records the secret *names*, not secret values. The fragment at `config/secrets-store-bindings.fragment.json` is a non-runnable Wrangler configuration fragment. It is not automatically applied by the Worker. Do not attach it to the public preview or connect queues until the release gates below are met.

## SMTP mapping

The Cloudflare account `Projects Public Portfolio` contains the `leadmaster-secrets` store. The following observed active secret names are mapped to the names consumed by `src/ses-smtp.mjs`, which uses async `get()` for each binding:

| Worker binding | Secrets Store name | State |
| --- | --- | --- |
| `SES_SMTP_HOST` | `AWS_SES_SMTP_HOSTNAME` | Name present; value not inspected |
| `SES_SMTP_USERNAME` | `AWS_SES_SMTP_USERNAME` | Name present; value not inspected |
| `SES_SMTP_PASSWORD` | `AWS_SES_SMTP_PASSPWORD` | Name present; spelling needs operator confirmation |

The password secret really is spelled `PASSPWORD` in the store, and the fragment uses that exact spelling. Before using the mapping, confirm that it contains the SES SMTP password. If a corrected secret is created, update the fragment to its exact name; do not delete or replace existing secrets automatically. The actual host, credential validity, SES identity, production access and account quota have not been checked.

Set the non-secret `SES_FROM_EMAIL` to `noreply@leadmaster.jelvan.pro` only after verifying that sender with SES in Sydney (`ap-southeast-2`). `SES_MAX_MESSAGES_PER_SECOND=10` and `SES_MAX_MESSAGES_PER_DAY=50000` are the requested limits, not independently verified quotas. The daily coordinator counter cannot account for other senders in the same SES account and region.

## Remaining credentials

The store also has `ADMIN_EMAIL_1`, `ADMIN_PASSWORD_1`, and `ADMIN_JWT_1`. They are not bound because the admin authentication and session implementation does not exist. In particular, a value named `ADMIN_JWT_1` must not be assumed to be a signing key or substituted for the email API key. `ADMIN_USERNAME_1` was not present; a username is needed if username sign-in is required in addition to email. A separate `EMAIL_API_KEY` was not present, and is required by the experimental email submission route. Cloudflare Turnstile needs a public site key and a separate server secret; neither was seen as a named store secret or current Worker binding. The public site key need not be a secret, but must match the intended hostname.

Design and review password hashing, session-signing key management, allowlisting, Turnstile validation and access controls before selecting or binding admin credentials. Never put credentials into source control, browser code, logs, or this documentation.

## Deployment status and gates

- `leadmaster-preview` currently has only a `PREVIEW_ASSETS` KV binding. It is a separate KV-backed preview script, not the repository's app Worker. Giving it SMTP or admin secrets would not implement the application and would expand access unnecessarily.
- `leadmaster-email` and `leadmaster-email-dlq` exist, but have no producer or consumer attached. Queue durability, dead-letter processing, monitoring, replay and recovery are not ready.
- A production Worker needs the correct asset, coordinator and queue bindings plus its migrations, a protected API key, authorization, abuse controls, and durable outbox/reconciliation. Authentication, OTP and the dashboard APIs are not implemented. Do not turn on `EMAIL_API_ENABLED` until security review and release gates are complete.
- Validate the configuration in an isolated environment. Verify sender, quotas and account sharing, and obtain an approved recipient before a live email test. No values were retrieved, and no live send or deployment was performed as part of this review.

Cloudflare documents [Secrets Store Worker bindings](https://developers.cloudflare.com/secrets-store/integrations/workers/) and [queue configuration](https://developers.cloudflare.com/workers/wrangler/configuration/).
