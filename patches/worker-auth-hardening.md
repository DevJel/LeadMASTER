# worker.js auth hardening (apply on main, test on a branch first)

Reviewed from main as of 2026-11-16. Not run against production: no Cloudflare logs or runtime access were available.

## Most likely cause of "service unavailable" after the OTP
`verifyOtp` already returns the session cookie before it does anything else risky. The browser then loads /dashboard,
and **every** request calls `sessionFor()`, which calls `accountForEmail()`. That function runs 1 SELECT and up to
4 writes (INSERT OR IGNORE members + 3 UPDATE adoption statements) on every page load, API call and /api/auth/session
poll, with no error handling. Any D1 hiccup there is thrown out of `handle()` and surfaces as the generic
`342322` 503. A valid session then looks like a failed login.

Confirm in Workers Logs: search for `LEADMASTER_UNHANDLED_SYSTEM_ERROR` right after a verify, and for the markers
`OTP_VERIFY_IDENTITY_UNAVAILABLE`, `OTP_VERIFY_CHALLENGE_READ_UNAVAILABLE`, `OTP_VERIFY_KEY_UNAVAILABLE`,
`OTP_SESSION_BATCH_FAILED`. Whichever appears tells you if it is this or a Secrets Store / D1 read in verify itself.

## 1. accountForEmail: reads stay on the critical path, writes become best-effort
Replace everything after `if (!account) throw new Error("Account could not be initialized");` with:

```js
  // Membership and legacy-adoption writes are idempotent housekeeping. They must never
  // turn a valid session into a 503, and they should not run on every request.
  try {
    await env.AUTH_DB.prepare("INSERT OR IGNORE INTO account_members (account_id,email,role,created_at) VALUES (?,?, 'owner', ?)").bind(account.id, ownerEmail, Date.now()).run();
    await env.AUTH_DB.prepare("UPDATE developer_api_keys SET account_id=? WHERE account_id IS NULL AND lower(trim(created_by))=?").bind(account.id, ownerEmail).run();
    await env.AUTH_DB.prepare("UPDATE developer_email_requests SET account_id=? WHERE account_id IS NULL AND api_key_id IN (SELECT id FROM developer_api_keys WHERE account_id=?)").bind(account.id, account.id).run();
    await env.AUTH_DB.prepare("UPDATE developer_webhooks SET account_id=? WHERE account_id IS NULL AND api_key_id IN (SELECT id FROM developer_api_keys WHERE account_id=?)").bind(account.id, account.id).run();
  } catch { console.error("ACCOUNT_HOUSEKEEPING_FAILED"); }
  return account;
```

Also wrap the first SELECT/INSERT in `sessionFor` so a failed account lookup falls back to the session row instead of throwing:

```js
  let account;
  try { account = await accountForEmail(env, row.email); } catch { console.error("SESSION_ACCOUNT_LOOKUP_FAILED"); return null; }
  if (!account) return null;
```
(returning null sends the browser to /login with a clear state, rather than a 503 with a valid cookie.)

## 2. login: do not let the audit log block the code email
`await logWorkspaceAction(env,adminEmail,"sign_in_code_sent",...)` runs before the email is sent and is unguarded.
If `workspace_activity` is unavailable the user gets 342322 and no code. Change to:

```js
  try { await logWorkspaceAction(env, adminEmail, "sign_in_code_sent", "Requested a sign-in code."); } catch {}
```

## 3. Client: show a retry state, not a dead end
`errorCode: "LM-AUTH-RETRY"` is returned on transient 503s. In public/login.js, on that code (or any 503 from
/api/auth/verify) keep the six digits entered, show "Taking longer than usual, trying again" and retry the same
POST once after ~1.5 s. The server consumes the code only on success, so a retry is safe.

## 4. Docs vs code mismatch to resolve
SES_TRANSPORT.md says the deployed Worker uses implicit TLS on port 465. src/ses-smtp.mjs on main uses STARTTLS on 587.
One of them is stale. OTP emails do arrive, so check which is live before the next change.
