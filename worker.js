import { connect } from "cloudflare:sockets";
import { sendSesEmail } from "./src/ses-smtp.mjs";
import { emailOtpTemplate, emailSecurityAlertTemplate } from "./src/email-templates.mjs";
import { staticAssets } from "./src/static-assets.mjs";

const SITEKEY = "0x4AAAAAAF5KTL83dA8wIZQH";
const HOSTNAME = "leadmaster.jelvan.pro";
const ADMIN_EMAIL = "admin@work.jelvan.pro";
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
async function verifyTurnstile(token, request, env, action) {
  if (typeof token !== "string" || token.length < 1 || token.length > 2048) return false;
  const key = await secret(env.TURNSTILE_SECRET);
  if (!key) return false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const form = new FormData();
      form.set("secret", key);
      form.set("response", token);
      const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form, signal: controller.signal });
      if (!response.ok) return false;
      const result = await response.json();
      return result.success === true && result.hostname === HOSTNAME && result.action === action;
    } finally { clearTimeout(timer); }
  } catch { return false; }
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
async function sessionFor(request, env) {
  const token = cookieValue(request, SESSION_COOKIE);
  if (!token || token.length > 200) return null;
  const tokenHash = await sha256(token);
  const row = await env.AUTH_DB.prepare("SELECT email, expires_at, revoked_at FROM auth_sessions WHERE token_hash = ?").bind(tokenHash).first();
  if (!row || row.revoked_at || row.expires_at <= Date.now()) return null;
  return { email: row.email, tokenHash };
}
async function authConfig(request) {
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405, { allow: "GET" });
  return json({ turnstileSiteKey: SITEKEY });
}
async function login(request, env) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, { allow: "POST" });
  if (!sameOrigin(request)) return json({ error: "Invalid request" }, 403);
  let body;
  try { body = await readJson(request); } catch { return json({ error: "Invalid request" }, 400); }
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  if (!(await rateLimit(env, "ip:" + ip, 10, 15 * 60 * 1000))) return json({ error: "Too many attempts" }, 429);
  if (!(await verifyTurnstile(body.turnstileToken, request, env, "login"))) return json({ error: "Security verification failed" }, 403);
  const identity = typeof body.identity === "string" ? body.identity.trim().toLowerCase() : "";
  if (identity !== ADMIN_EMAIL || !(await rateLimit(env, "email:" + ADMIN_EMAIL, 8, 15 * 60 * 1000))) return json({ error: "Unable to sign in" }, 401);
  const configuredPassword = await secret(env.ADMIN_PASSWORD);
  const sessionSecret = await secret(env.SESSION_SECRET);
  if (!configuredPassword || !sessionSecret || !(await passwordMatches(body.password, configuredPassword))) return json({ error: "Unable to sign in" }, 401);
  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
  const id = crypto.randomUUID();
  const codeHash = await hmac(sessionSecret, "otp:" + id + ":" + code);
  const now = Date.now();
  await env.AUTH_DB.prepare("DELETE FROM auth_challenges WHERE email = ?").bind(ADMIN_EMAIL).run();
  await env.AUTH_DB.prepare("INSERT INTO auth_challenges (id,email,code_hash,created_at,expires_at,attempts) VALUES (?,?,?,?,?,0)")
    .bind(id, ADMIN_EMAIL, codeHash, now, now + 10 * 60 * 1000).run();
  try {
    await sendSesEmail({
      connect,
      env,
      to: ADMIN_EMAIL,
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
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, { allow: "POST" });
  if (!sameOrigin(request)) return json({ error: "Invalid request" }, 403);
  let body;
  try { body = await readJson(request); } catch { return json({ error: "Invalid request" }, 400); }
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  if (!(await rateLimit(env, "verify-ip:" + ip, 12, 15 * 60 * 1000))) return json({ error: "Too many attempts" }, 429);
  const code = typeof body.code === "string" ? body.code : "";
  if (!/^\d{6}$/.test(code)) return json({ error: "Invalid code" }, 400);
  const row = await env.AUTH_DB.prepare("SELECT id,code_hash,expires_at,attempts FROM auth_challenges WHERE email = ? ORDER BY created_at DESC LIMIT 1").bind(ADMIN_EMAIL).first();
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
    .bind(tokenHash, ADMIN_EMAIL, now, expires).run();
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
      to: ADMIN_EMAIL,
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
function challengePage() {
  const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Verify access · LeadMASTER</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f7f7f5;color:#171717;font:15px system-ui,-apple-system,sans-serif}.panel{width:min(92vw,440px);padding:34px;border:1px solid #e4e4e1;border-radius:18px;background:#fff;box-shadow:0 24px 80px #17171712}.mark{color:#171717;font-weight:700;letter-spacing:.12em;font-size:12px}.panel h1{font-size:24px;margin:12px 0 8px}.muted{color:#666;line-height:1.55}.widget{margin:24px 0 12px;min-height:65px;display:flex;justify-content:center}.status{font-size:13px;color:#666;min-height:20px}</style><script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script></head><body><main class="panel"><div class="mark">LEADMASTER</div><h1>Verify you are human</h1><p class="muted">Complete this quick security check to continue to LeadMASTER.</p><div class="widget"><div class="cf-turnstile" data-sitekey="' + SITEKEY + '" data-theme="light" data-action="managed" data-callback="verified" data-error-callback="failed"></div></div><div class="status" id="status" role="status" aria-live="polite"></div></main><script>async function verified(token){const s=document.getElementById("status");s.textContent="Verifying…";try{const returnTo=location.pathname+location.search;const r=await fetch("/_turnstile/verify",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token,returnTo})});if(!r.ok)throw new Error("Verification failed");const d=await r.json();location.replace(d.redirect||"/")}catch(e){s.textContent="Verification could not be completed. Please refresh and try again.";if(window.turnstile)turnstile.reset()}}function failed(){document.getElementById("status").textContent="Security check failed. Please try again."}</script></body></html>';
  return new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", "referrer-policy": "strict-origin-when-cross-origin" } });
}
async function handle(request, env) {
  const url = new URL(request.url);


  if (url.pathname === "/api/auth/config") return authConfig(request);
  if (url.pathname === "/api/auth/login") return login(request, env);
  if (url.pathname === "/api/auth/verify") return verifyOtp(request, env);
  if (url.pathname === "/api/auth/logout") return logout(request, env);
  if (url.pathname === "/api/auth/session" && request.method === "GET") {
    const session = await sessionFor(request, env);
    return json({ authenticated: Boolean(session), email: session?.email || null });
  }

  if (url.pathname === "/dashboard") {
    const session = await sessionFor(request, env);
    if (!session) return Response.redirect(new URL("/login.html", request.url), 302);
    return Response.redirect(new URL("/dashboard.html", request.url), 302);
  }
  const protectedPaths = ["/dashboard.html", "/dashboard.js", "/dashboard.css", "/html-preview.js", "/html-preview.css", "/assets/vendor/dompurify.min.js"];
  if (protectedPaths.includes(url.pathname)) {
    const session = await sessionFor(request, env);
    if (!session) return Response.redirect(new URL("/login.html", request.url), 302);
  }
  if (url.pathname === "/logout" && request.method === "GET") return Response.redirect(new URL("/login.html", request.url), 302);

  const asset = staticAssets[url.pathname];
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
      if (!env.AUTH_DB || !env.ADMIN_PASSWORD || !env.SESSION_SECRET || !env.SES_SMTP_HOST || !env.SES_SMTP_USERNAME || !env.SES_SMTP_PASSWORD || !env.SES_FROM_EMAIL) {
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
