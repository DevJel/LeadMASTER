# LeadMASTER Backend Error Codes

This document is for repository maintainers and authorized developers. Backend codes and diagnostic mappings are internal implementation details. They must never be rendered in the public Help Center or exposed with raw infrastructure messages.

## Public fallback

Unknown or unclassified internal failures use **342322**. The frontend must show only the standard support message and must not display stack traces, HTTP status numbers, database statements, paths, provider responses, API keys, SMTP logs or tokens.

## Auth and access — 342100–342199

| Code | Internal cause | Internal evidence / troubleshooting |
|---|---|---|
| 342100 | Authentication service binding or session store unavailable | Check Worker invocation logs tagged `LEADMASTER_AUTH`; verify AUTH_DB and session-secret bindings. |
| 342101 | Sign-in challenge could not be verified | Check Turnstile verification outcome and configured hostname/action; never log submitted tokens. |
| 342102 | Email one-time-code delivery coordinator unavailable | Check EmailCoordinator health and SES accepted/rejected events; do not log OTP values. |
| 342103 | Session token validation or persistence failed | Inspect auth-session query outcome and expiry/revocation state without exposing token hashes. |
| 342104 | Account membership lookup failed | Check account-membership query and D1 availability; confirm no cross-account lookup. |

## Email and SMTP — 342200–342299

| Code | Internal cause | Internal evidence / troubleshooting |
|---|---|---|
| 342200 | Shared email coordinator unavailable | Inspect `EMAIL_COORDINATOR` readiness, Durable Object alarms and health response. |
| 342201 | SMTP transport rejected a submission | Check redacted SES SMTP outcome, message correlation ID and SES event delivery/rejection events. |
| 342202 | MIME or message validation failed internally | Inspect sanitized message metadata and builder validation; never log message body or credentials. |
| 342203 | Queue submission could not be confirmed | Inspect queue producer result, batch ID and queue consumer logs; do not retry an uncertain send automatically. |
| 342204 | Delivery-event processing failed | Check SNS signature validation, topic binding and SES event correlation. |

## AI workers — 342300–342399

| Code | Internal cause | Internal evidence / troubleshooting |
|---|---|---|
| 342300 | AI binding unavailable | Verify the Worker AI binding is configured and permitted for the deployed script. |
| 342301 | Model invocation failed | Inspect redacted AI invocation logs, selected model and service availability. |
| 342302 | Model response was invalid or could not be parsed | Check structured-output validation and bounded model response metadata. |
| 342303 | HTML generation failed safety validation | Inspect sanitizer rejection category and output length; never trust model-generated markup. |
| 342322 | Default, unclassified LeadMASTER system failure | Correlate Worker invocation ID with internal logs, deployment version and service health checks. |

## Database — 342400–342499

| Code | Internal cause | Internal evidence / troubleshooting |
|---|---|---|
| 342400 | D1 database unavailable | Check D1 availability, database binding, query latency and Worker logs. |
| 342401 | Required schema or migration missing | Compare `sqlite_master` with repository migrations and apply only reviewed additive migrations. |
| 342402 | Record write conflict or transaction failure | Inspect D1 result metadata, idempotency key and account-scoped record ID. |
| 342403 | Record ownership or integrity verification failed internally | Check workspace ID/account ID ownership constraints and audit trail. |

## Integrations — 342500–342599

| Code | Internal cause | Internal evidence / troubleshooting |
|---|---|---|
| 342500 | Third-party service request failed | Inspect redacted integration response category and correlation ID. |
| 342501 | Integration authorization refresh failed | Confirm the connected account authorization state; never log refresh tokens. |
| 342502 | External callback signature or payload validation failed | Check signature verification, callback timestamp and bounded payload schema. |
| 342503 | Cloud storage operation failed | Check R2 binding, object key ownership and storage availability. |
| 342504 | Currency or rate provider unavailable | Check provider reachability and cached quote age; do not invent a rate. |

## Operational rules

1. Keep this table in repository documentation only.
2. Frontend code must call `mapLeadMasterError` and render only the mapped customer message.
3. Keep diagnostic detail in protected Worker logs with correlation identifiers; exclude passwords, tokens, OTPs, SMTP credentials and message bodies.
4. Do not expose raw HTTP status codes, stack traces, SQL, filesystem paths, request headers or provider responses.
5. A queue-accepted email is not a delivered email. Delivery is confirmed only by the SES event path.
