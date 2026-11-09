import { connect } from "cloudflare:sockets";
import { sendSesEmail } from "./src/ses-smtp.mjs";
import { emailOtpTemplate, emailSecurityAlertTemplate } from "./src/email-templates.mjs";
import { staticAssets } from "./src/static-assets.mjs";
import { developerAdminRoute, developerEmailRoute, developerEmailStatus, developerAccountInfo } from "./src/developer-api.mjs";
import { webhookRoute } from "./src/developer-webhooks.mjs";
import { verifyTurnstile } from "./src/turnstile.mjs";

const HOSTNAME = "leadmaster.jelvan.pro";
const UPSTREAM = "https://leadmaster-preview.projects-public-portfolio.workers.dev";
const CHALLENGE_COOKIE = "lm_turnstile";
const SESSION_COOKIE = "lm_session";
const enc = new TextEncoder();

function b64url(bytes) {
  let s = "";
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
function randomToken(bytes = 32) {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return b64url(value);
}
async function sha256(value) {
  const out = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(value)));
  return Array.from(out, b => b.toString(16).padStart(2, "0")).join("");
}
async function secret(binding) {
  try {
    const value = typeof binding?.get === "function" ? await binding.get() : binding;
    return typeof value === "string" && value.length > 0 ? value : null;
  } catch { return null; }
}
async function hmac(keyValue, value) {
  const key = await crypto.subtle.importKey("raw", enc.encode(keyValue), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const out = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(value)));
  return Array.from(out, b => b.toString(16).padStart(2, "0")).join("");
}
function equal(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function json(body, status = 200, headers = {}) {
  return Response.json(body, { status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff", ...headers } });
}
function cookieValue(request, name) {
  const raw = request.headers.get("Cookie") || "";
  const item = raw.split(";").map(x => x.trim()).find(x => x.startsWith(name + "="));
  return item ? item.slice(name.length + 1) : "";
}
function sameOrigin(request) {
  const origin = request.headers.get("Origin");
  return origin === new URL(request.url).origin;
}
async function readJson(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") || "")) throw new Error("bad-content-type");
  const raw = await request.text();
  if (enc.encode(raw).length > 12000) throw new Error("too-large");
  const body = JSON.parse(raw);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("bad-body");
  return body;
}
async function verifyLoginTurnstile(token, env, action) {
  return verifyTurnstile({
    token,
    secret: env.TURNSTILE_SECRET,
    expectedHostname: HOSTNAME,
    expectedAction: action
  });
}
async function challengeCookieValid(request, env) {
  const value = cookieValue(request, CHALLENGE_COOKIE);
  const [exp, signature] = value.split(".");
  if (!exp || !signature || !/^\d+$/.test(exp) || Number(exp) < Math.floor(Date.now() / 1000)) return false;
  const key = await secret(env.TURNSTILE_SECRET);
  if (!key) return false;
  return equal(await hmac(key, exp), signature);
}
async function rateLimit(env, key, limit, windowMs) {
  const now = Date.now();
  const threshold = now - windowMs;
  const result = await env.AUTH_DB.prepare(
    "INSERT INTO auth_rate_limits (bucket_key, window_start, count) VALUES (?, ?, 1) " +
    "ON CONFLICT(bucket_key) DO UPDATE SET " +
    "count = CASE WHEN auth_rate_limits.window_start <= ? THEN 1 ELSE auth_rate_limits.count + 1 END, " +
    "window_start = CASE WHEN auth_rate_limits.window_start <= ? THEN excluded.window_start ELSE auth_rate_limits.window_start END " +
    "RETURNING count"
  ).bind(key, now, threshold, threshold).first();
  return Number(result?.count || 0) <= limit;
}
async function renderEmailTemplate(path, replacements) {
  const templates = {
    "/email-otpformat.html": emailOtpTemplate,
    "/email-securityalert.html": emailSecurityAlertTemplate
  };
  let html = templates[path];
  if (typeof html !== "string" || html.length > 200000) throw new Error("Email template unavailable");
  for (const [key, value] of Object.entries(replacements)) {
    const safe = String(value ?? "").replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[ch]);
    html = html.replaceAll("{{" + key + "}}", safe);
  }
  return html;
}
function loginDetails(request) {
  const cf = request.cf || {};
  const city = typeof cf.city === "string" ? cf.city : "";
  const region = typeof cf.region === "string" ? cf.region : "";
  const country = typeof cf.country === "string" ? cf.country : "";
  const location = [city, region, country].filter(Boolean).join(", ") || country || "Location unavailable";
  const ua = request.headers.get("User-Agent") || "";
  const browser = /Edg\//.test(ua) ? "Microsoft Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Google Chrome" : /Safari\//.test(ua) ? "Safari" : "Unknown browser";
  const device = /iPhone|iPad|Android|Mobile/i.test(ua) ? "Mobile device" : /Windows|Macintosh|Linux/i.test(ua) ? "Desktop device" : "Unknown device";
  return {
    location,
    time: new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "long", timeZone: "UTC" }).format(new Date()) + " (UTC)",
    device,
    browser,
    ip_address: request.headers.get("CF-Connecting-IP") || "Unavailable"
  };
}
async function configuredAdminEmail(env) {
  const value = await secret(env.ADMIN_EMAIL);
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
}
async function passwordMatches(supplied, configured) {
  if (typeof supplied !== "string" || typeof configured !== "string" || supplied.length > 1024) return false;
  // Supports an optional pbkdf2$iterations$salt$hex representation, as well as
  // the existing secret-store password value during migration.
  const parts = configured.split("$");
  if (parts.length === 4 && parts[0] === "pbkdf2") {
    const iterations = Number(parts[1]);
    if (!Number.isInteger(iterations) || iterations < 100000 || iterations > 1000000 || !/^[0-9a-f]{64}$/i.test(parts[3])) return false;
    try {
      const material = await crypto.subtle.importKey("raw", enc.encode(supplied), "PBKDF2", false, ["deriveBits"]);
      const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: enc.encode(parts[2]), iterations, hash: "SHA-256" }, material, 256);
      const actual = Array.from(new Uint8Array(bits), b => b.toString(16).padStart(2, "0")).join("");
      return equal(actual, parts[3].toLowerCase());
    } catch { return false; }
  }
  return equal(await sha256(supplied), await sha256(configured));
}
async function accountForEmail(env, email) {
  const ownerEmail = String(email || "").trim().toLowerCase();
  if (!ownerEmail) throw new Error("Account identity unavailable");
  let account = await env.AUTH_DB.prepare("SELECT id,name,created_at,updated_at FROM accounts WHERE owner_email=?").bind(ownerEmail).first();
  if (!account) {
    const id = "acct_" + randomToken(16);
    const now = Date.now();
    await env.AUTH_DB.prepare("INSERT INTO accounts (id,name,owner_email,created_at,updated_at) VALUES (?, 'My LeadMASTER workspace', ?, ?, ?) ON CONFLICT(owner_email) DO NOTHING").bind(id,ownerEmail,now,now).run();
    account = await env.AUTH_DB.prepare("SELECT id,name,created_at,updated_at FROM accounts WHERE owner_email=?").bind(ownerEmail).first();
  }
  if (!account) throw new Error("Account could not be initialized");
  await env.AUTH_DB.prepare("INSERT OR IGNORE INTO account_members (account_id,email,role,created_at) VALUES (?,?, 'owner', ?)").bind(account.id,ownerEmail,Date.now()).run();
  // Adopt legacy integrations only when their recorded owner exactly matches this signed-in identity.
  await env.AUTH_DB.prepare("UPDATE developer_api_keys SET account_id=? WHERE account_id IS NULL AND lower(trim(created_by))=?").bind(account.id,ownerEmail).run();
  await env.AUTH_DB.prepare("UPDATE developer_email_requests SET account_id=? WHERE account_id IS NULL AND api_key_id IN (SELECT id FROM developer_api_keys WHERE account_id=?)").bind(account.id,account.id).run();
  await env.AUTH_DB.prepare("UPDATE developer_webhooks SET account_id=? WHERE account_id IS NULL AND api_key_id IN (SELECT id FROM developer_api_keys WHERE account_id=?)").bind(account.id,account.id).run();
  return account;
}
async function sessionFor(request, env) {
  const token = cookieValue(request, SESSION_COOKIE);
  if (!token || token.length > 200) return null;
  const tokenHash = await sha256(token);
  const row = await env.AUTH_DB.prepare("SELECT email, expires_at, revoked_at FROM auth_sessions WHERE token_hash = ?").bind(tokenHash).first();
  if (!row || row.revoked_at || row.expires_at <= Date.now()) return null;
  const account = await accountForEmail(env,row.email);
  return { email: row.email, tokenHash, accountId: account.id, accountName: account.name };
}
async function authConfig(request, env) {
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405, { allow: "GET" });
  const siteKey = await secret(env.TURNSTILE_SITE_KEY);
  if (!siteKey || !/^0x4[A-Za-z0-9_-]{20,}$/.test(siteKey)) return json({ error: "Security verification is not configured" }, 503);
  return json({ turnstileSiteKey: siteKey });
}
async function login(request, env) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, { allow: "POST" });
  if (!sameOrigin(request)) return json({ error: "Invalid request" }, 403);
  let body;
  try { body = await readJson(request); } catch { return json({ error: "Invalid request" }, 400); }
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  if (!(await rateLimit(env, "ip:" + ip, 10, 15 * 60 * 1000))) return json({ error: "Too many attempts" }, 429);
  if (!(await verifyLoginTurnstile(body.turnstileToken, env, "login"))) return json({ error: "Security verification failed" }, 403);
  const identity = typeof body.identity === "string" ? body.identity.trim().toLowerCase() : "";
  const adminEmail = await configuredAdminEmail(env);
  if (!adminEmail || identity !== adminEmail || !(await rateLimit(env, "email:" + adminEmail, 8, 15 * 60 * 1000))) return json({ error: "Unable to sign in" }, 401);
  const configuredPassword = await secret(env.ADMIN_PASSWORD);
  const sessionSecret = await secret(env.SESSION_SECRET);
  if (!configuredPassword || !sessionSecret || !(await passwordMatches(body.password, configuredPassword))) return json({ error: "Unable to sign in" }, 401);
  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
  const id = crypto.randomUUID();
  const codeHash = await hmac(sessionSecret, "otp:" + id + ":" + code);
  const now = Date.now();
  await env.AUTH_DB.prepare("DELETE FROM auth_challenges WHERE email = ?").bind(adminEmail).run();
  await env.AUTH_DB.prepare("INSERT INTO auth_challenges (id,email,code_hash,created_at,expires_at,attempts) VALUES (?,?,?,?,?,0)")
    .bind(id, adminEmail, codeHash, now, now + 10 * 60 * 1000).run();
  try {
    await sendSesEmail({
      connect,
      env,
      to: adminEmail,
      subject: "Your LeadMASTER sign-in code",
      text: "Your LeadMASTER verification code is " + code + ". It expires in 10 minutes. If you did not request this code, you can ignore this email.",
      html: await renderEmailTemplate("/email-otpformat.html", { USER_NAME: "Admin", OTP_CODE: code, EXPIRY_MINUTES: "10" })
    });
  } catch {
    await env.AUTH_DB.prepare("DELETE FROM auth_challenges WHERE id = ?").bind(id).run();
    return json({ error: "Email verification is temporarily unavailable" }, 503);
  }
  return json({ next: "verify_email" });
}
async function verifyOtp(request, env) {
  const adminEmail = await configuredAdminEmail(env);
  if (!adminEmail) return json({ error: "Authentication service is not configured" }, 503);
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, { allow: "POST" });
  if (!sameOrigin(request)) return json({ error: "Invalid request" }, 403);
  let body;
  try { body = await readJson(request); } catch { return json({ error: "Invalid request" }, 400); }
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  if (!(await rateLimit(env, "verify-ip:" + ip, 12, 15 * 60 * 1000))) return json({ error: "Too many attempts" }, 429);
  const code = typeof body.code === "string" ? body.code : "";
  if (!/^\d{6}$/.test(code)) return json({ error: "Invalid code" }, 400);
  const row = await env.AUTH_DB.prepare("SELECT id,code_hash,expires_at,attempts FROM auth_challenges WHERE email = ? ORDER BY created_at DESC LIMIT 1").bind(adminEmail).first();
  if (!row || row.expires_at <= Date.now() || row.attempts >= 5) return json({ error: "Invalid or expired code" }, 401);
  const sessionSecret = await secret(env.SESSION_SECRET);
  if (!sessionSecret) return json({ error: "Service unavailable" }, 503);
  const candidate = await hmac(sessionSecret, "otp:" + row.id + ":" + code);
  if (!equal(candidate, row.code_hash)) {
    await env.AUTH_DB.prepare("UPDATE auth_challenges SET attempts = attempts + 1 WHERE id = ? AND attempts < 5").bind(row.id).run();
    return json({ error: "Invalid or expired code" }, 401);
  }
  const consumed = await env.AUTH_DB.prepare("DELETE FROM auth_challenges WHERE id = ? AND code_hash = ? AND attempts < 5").bind(row.id, row.code_hash).run();
  if ((consumed.meta?.changes || 0) !== 1) return json({ error: "Invalid or expired code" }, 401);
  const token = randomToken(32);
  const tokenHash = await sha256(token);
  const now = Date.now();
  const expires = now + 8 * 60 * 60 * 1000;
  await env.AUTH_DB.prepare("INSERT INTO auth_sessions (token_hash,email,created_at,expires_at,revoked_at) VALUES (?,?,?,?,NULL)")
    .bind(tokenHash, adminEmail, now, expires).run();
  // Send the branded security alert after the authenticated session is established.
  // Alert delivery is best-effort so an email outage cannot strand a valid login.
  try {
    const details = loginDetails(request);
    const html = await renderEmailTemplate("/email-securityalert.html", {
      USER_NAME: "Admin",
      location: details.location,
      time: details.time,
      device: details.device,
      browser: details.browser,
      ip_address: details.ip_address
    });
    await sendSesEmail({
      connect,
      env,
      to: adminEmail,
      subject: "New login detected — LeadMASTER",
      text: "A new login to your LeadMASTER account was detected. Location: " + details.location +
        ". Time: " + details.time + ". Device: " + details.device + ". Browser: " + details.browser +
        ". IP address: " + details.ip_address + ". If this was not you, secure your account immediately.",
      html
    });
  } catch {
    // Authentication remains successful; do not expose delivery internals.
  }
  return json({ authenticated: true }, 200, {
    "set-cookie": SESSION_COOKIE + "=" + token + "; Path=/; Max-Age=28800; HttpOnly; Secure; SameSite=Strict"
  });
}
async function logout(request, env) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, { allow: "POST" });
  if (!sameOrigin(request)) return json({ error: "Invalid request" }, 403);
  const session = await sessionFor(request, env);
  if (session) await env.AUTH_DB.prepare("UPDATE auth_sessions SET revoked_at = ? WHERE token_hash = ?").bind(Date.now(), session.tokenHash).run();
  return json({ ok: true }, 200, { "set-cookie": SESSION_COOKIE + "=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict" });
}

async function handle(request, env) {
  const url = new URL(request.url);


  if (url.pathname === "/api/developer/keys" || url.pathname.startsWith("/api/developer/keys/")) {
    const session = await sessionFor(request, env);
    return developerAdminRoute(request, env, session);
  }
  const accountApi = url.pathname.match(/^\/api\/v1\/accounts\/(acct_[A-Za-z0-9_-]{20,64})(?:\/(emails|webhooks)(?:\/([0-9a-f-]{36})(?:\/(deliveries))?)?)?$/i);
  if (accountApi) {
    const accountId = accountApi[1], resource = accountApi[2], resourceId = accountApi[3], suffix = accountApi[4];
    if (!resource) return developerAccountInfo(request,env,accountId);
    if (resource === "emails" && !resourceId) return developerEmailRoute(request,env,connect,accountId);
    if (resource === "emails" && resourceId) return developerEmailStatus(request,env,accountId);
    if (resource === "webhooks") return webhookRoute(request,env,accountId);
  }
  if (url.pathname === "/api/auth/config") return authConfig(request, env);
  if (url.pathname === "/api/auth/login") return login(request, env);
  if (url.pathname === "/api/auth/verify") return verifyOtp(request, env);
  if (url.pathname === "/api/auth/logout") return logout(request, env);
  if (url.pathname === "/api/auth/session" && request.method === "GET") {
    const session = await sessionFor(request, env);
    return json({ authenticated: Boolean(session), email: session?.email || null, account: session ? { id: session.accountId, name: session.accountName, api_base_url: "https://leadmaster.jelvan.pro/api/v1/accounts/" + session.accountId, endpoints: { account: "/api/v1/accounts/" + session.accountId, emails: "/api/v1/accounts/" + session.accountId + "/emails", webhooks: "/api/v1/accounts/" + session.accountId + "/webhooks" } } : null });
  }

  if (url.pathname === "/dashboard") {
    const session = await sessionFor(request, env);
    if (!session) return Response.redirect(new URL("/login.html", request.url), 302);
    return Response.redirect(new URL("/dashboard.html", request.url), 302);
  }
  const protectedPaths = ["/dashboard.html", "/developer-api-keys.html", "/dashboard.js", "/dashboard.css", "/html-preview.js", "/html-preview.css", "/assets/vendor/dompurify.min.js"];
  if (protectedPaths.includes(url.pathname)) {
    const session = await sessionFor(request, env);
    if (!session) return Response.redirect(new URL("/login.html", request.url), 302);
  }
  if (url.pathname === "/logout" && request.method === "GET") return Response.redirect(new URL("/login.html", request.url), 302);

  if (url.pathname === "/mcp" || url.pathname.startsWith("/mcp/")) return json({ error: "MCP is not available in production. Use the documented LeadMASTER REST API." }, 404);

  const assetPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const asset = staticAssets[assetPath];
  if (asset) {
    const isHtml = asset.contentType.startsWith("text/html");
    return new Response(asset.body, { status: 200, headers: {
      "content-type": asset.contentType,
      "cache-control": isHtml ? "no-store" : "public, max-age=300",
      "x-content-type-options": "nosniff",
      "referrer-policy": "strict-origin-when-cross-origin"
    }});
  }

  const upstream = new URL(url.pathname + url.search, UPSTREAM);
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.set("x-forwarded-host", url.host);
  headers.set("x-forwarded-proto", url.protocol.replace(":", ""));
  const response = await fetch(new Request(upstream, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    redirect: "manual"
  }));
  const outHeaders = new Headers(response.headers);
  outHeaders.set("x-content-type-options", "nosniff");
  outHeaders.set("referrer-policy", "strict-origin-when-cross-origin");
  if (url.pathname === "/login.html" || url.pathname === "/dashboard.html") outHeaders.set("cache-control", "no-store");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: outHeaders });
}

export default {
  async fetch(request, env) {
    try {
      if (!env.AUTH_DB || !env.ADMIN_EMAIL || !env.ADMIN_PASSWORD || !env.SESSION_SECRET || !env.TURNSTILE_SITE_KEY || !env.TURNSTILE_SECRET || !env.SES_SMTP_HOST || !env.SES_SMTP_USERNAME || !env.SES_SMTP_PASSWORD || !env.SES_FROM_EMAIL) {
        // Public pages remain available while auth fails closed.
        const p = new URL(request.url).pathname;
        if (p.startsWith("/api/auth/") || p.startsWith("/dashboard")) return json({ error: "Authentication service is not configured" }, 503);
      }
      return await handle(request, env);
    } catch {
      return json({ error: "Service temporarily unavailable" }, 503);
    }
  }
};
