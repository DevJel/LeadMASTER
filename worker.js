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
      fromName: "LeadMaster",
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


async function adminMailboxRoute(request,env,session){
 if(!session||session.email!==await configuredAdminEmail(env))return json({error:"Forbidden"},403);
 if(!env.INBOUND_MAIL||!env.AUTH_DB)return json({error:"Mailbox storage unavailable"},503);
 const url=new URL(request.url),parts=url.pathname.split("/").filter(Boolean),folder=url.searchParams.get("folder")||"inbox",q=(url.searchParams.get("q")||"").trim().slice(0,100),domain=(url.searchParams.get("domain")||"").toLowerCase();
 const counts={};
 for(const [k,sql] of Object.entries({inbox:"SELECT COUNT(*) n FROM inbound_mail WHERE archived_at IS NULL",sent:"SELECT COUNT(*) n FROM admin_sent_mail",bounced:"SELECT COUNT(*) n FROM email_delivery_events WHERE status='bounced'",unsuccessful:"SELECT (SELECT COUNT(*) FROM admin_sent_mail WHERE status IN ('failed','unknown'))+(SELECT COUNT(*) FROM developer_email_requests WHERE status IN ('failed','unknown')) n",unsubscribed:"SELECT COUNT(*) n FROM email_unsubscribes"})){const r=await env.AUTH_DB.prepare(sql).first();counts[k]=Number(r?.n||0);}
 if(request.method==="GET"&&url.pathname==="/api/admin/mail"){
  if(folder==="counts")return json({counts,storage:true});
  if(folder==="inbox"){const r=await env.AUTH_DB.prepare("SELECT id,from_address,to_address,subject,received_at,read_at,archived_at,delivery_status,size_bytes FROM inbound_mail WHERE archived_at IS NULL AND (?='' OR lower(from_address||' '||to_address||' '||subject) LIKE ?) AND (?='' OR lower(from_address) LIKE ? OR lower(to_address) LIKE ?) ORDER BY received_at DESC LIMIT 100").bind(q,q?"%"+q.toLowerCase()+"%":"",domain,domain?"%"+domain+"%":"",domain?"%"+domain+"%":"").all();return json({items:r.results||[],counts,storage:true,note:"Dedicated mailbox only. Existing forwarding routes are unchanged."});}
  if(folder==="sent"){const r=await env.AUTH_DB.prepare("SELECT id,recipient,subject,status,created_at,updated_at,from_email,reply_to FROM admin_sent_mail WHERE (?='' OR lower(recipient||' '||subject) LIKE ?) UNION ALL SELECT id,recipient,subject,status,created_at,updated_at,from_email,reply_to FROM developer_email_requests WHERE (?='' OR lower(recipient||' '||subject) LIKE ?) ORDER BY created_at DESC LIMIT 100").bind(q,q?"%"+q.toLowerCase()+"%":"",q,q?"%"+q.toLowerCase()+"%":"").all();return json({items:r.results||[],counts,note:"Sent means SES accepted the SMTP submission, not confirmed inbox delivery."});}
  if(folder==="bounced"){const r=await env.AUTH_DB.prepare("SELECT id,email AS recipient,subject,status,created_at AS received_at,detail FROM email_delivery_events WHERE status='bounced' ORDER BY created_at DESC LIMIT 100").all();return json({items:r.results||[],counts,note:"SES bounce-event destination is not yet connected; this folder will populate when SES events are configured."});}
  if(folder==="unsuccessful"){const r=await env.AUTH_DB.prepare("SELECT id,recipient,subject,status,created_at,updated_at,error_code FROM admin_sent_mail WHERE status IN ('failed','unknown') UNION ALL SELECT id,recipient,subject,status,created_at,updated_at,error_code FROM developer_email_requests WHERE status IN ('failed','unknown') ORDER BY created_at DESC LIMIT 100").all();return json({items:r.results||[],counts,note:"Failed = SMTP not accepted. Unknown = final SMTP acceptance could not be confirmed."});}
  if(folder==="unsubscribed"){const r=await env.AUTH_DB.prepare("SELECT id,email,source,created_at,reason AS subject FROM email_unsubscribes ORDER BY created_at DESC LIMIT 100").all();return json({items:r.results||[],counts,note:"Suppression records. No marketing unsubscribe capture endpoint is enabled."});}
  return json({error:"Unknown folder"},400);
 }
 const id=parts[3];
 if(parts.length===4&&request.method==="GET"&&/^[0-9a-f-]{36}$/i.test(id)){
  const row=await env.AUTH_DB.prepare("SELECT * FROM inbound_mail WHERE id=?").bind(id).first();
  if(row){const obj=await env.INBOUND_MAIL.get(row.r2_key);if(!obj)return json({error:"Original message unavailable"},404);const raw=await obj.text(),chunks=raw.split(/\r?\n\r?\n/),headers=chunks.shift()||"",body=chunks.join("\n"),part=body.split(/\r?\n--[^\r\n]+/).find(x=>/content-type:\s*text\/plain/i.test(x));let textBody=(part||body).replace(/^.*?\r?\n\r?\n/s,"");const transfer=(part||"").match(/content-transfer-encoding:\s*([^\r\n]+)/i)?.[1]?.trim().toLowerCase();try{if(transfer==="base64")textBody=atob(textBody.replace(/\s/g,""));else if(transfer==="quoted-printable")textBody=textBody.replace(/=\r?\n/g,"").replace(/=([0-9a-f]{2})/gi,(_,h)=>String.fromCharCode(parseInt(h,16)));}catch{textBody="Message body could not be decoded.";}await env.AUTH_DB.prepare("UPDATE inbound_mail SET read_at=COALESCE(read_at,?) WHERE id=?").bind(Date.now(),id).run();return json({id,from_address:row.from_address,to_address:row.to_address,subject:row.subject,received_at:row.received_at,read_at:row.read_at||Date.now(),text_body:textBody.slice(0,100000),attachments:(body.match(/content-disposition:\s*attachment/gi)||[]).length,download_url:"/api/admin/mail/"+id+"/source"});}
  const sent=await env.AUTH_DB.prepare("SELECT * FROM admin_sent_mail WHERE id=?").bind(id).first();if(sent)return json({id,sender:sent.from_email,recipient:sent.recipient,subject:sent.subject,created_at:sent.created_at,text_body:sent.text_body||"",status:sent.status});return json({error:"Message not found"},404);
 }
 if(parts.length===5&&parts[4]==="source"&&request.method==="GET"){const row=await env.AUTH_DB.prepare("SELECT r2_key FROM inbound_mail WHERE id=?").bind(id).first();if(!row)return json({error:"Not found"},404);const obj=await env.INBOUND_MAIL.get(row.r2_key);if(!obj)return json({error:"Not found"},404);return new Response(obj.body,{headers:{"content-type":"message/rfc822","content-disposition":'attachment; filename="leadmaster-message.eml"',"cache-control":"no-store","x-content-type-options":"nosniff"}});}
 if(parts.length===4&&request.method==="PATCH"){if(request.headers.get("Origin")!==url.origin)return json({error:"Invalid request"},403);let b;try{b=await readJson(request)}catch{return json({error:"Invalid request"},400)}if(typeof b.read==="boolean")await env.AUTH_DB.prepare("UPDATE inbound_mail SET read_at=? WHERE id=?").bind(b.read?Date.now():null,id).run();if(b.archive===true)await env.AUTH_DB.prepare("UPDATE inbound_mail SET archived_at=? WHERE id=?").bind(Date.now(),id).run();return json({ok:true});}
 return json({error:"Not found"},404);
}
async function adminSendRoute(request,env,session,connect){
 if(!session||session.email!==await configuredAdminEmail(env))return json({error:"Forbidden"},403);
 if(request.method!=="POST")return json({error:"Method not allowed"},405,{allow:"POST"});
 if(request.headers.get("Origin")!==new URL(request.url).origin)return json({error:"Invalid request"},403);
 let b;try{b=await readJson(request)}catch{return json({error:"Invalid request"},400)}
 const to=String(b.to||"").trim(),from=String(b.fromEmail||"").trim().toLowerCase(),subject=String(b.subject||""),textBody=String(b.text||""),domain=from.split("@")[1]||"";
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from)||!(domain==="jelvan.pro"||domain.endsWith(".jelvan.pro")||domain==="operavaglobal.com"||domain.endsWith(".operavaglobal.com")))return json({error:"Sender must be under a verified jelvan.pro or operavaglobal.com identity"},400);
 const id=crypto.randomUUID(),now=Date.now(),name=from==="hello@operavaglobal.com"?"Operava":from==="hello@work.jelvan.pro"?"Jelvan Ricolcol":"LeadMASTER";
 await env.AUTH_DB.prepare("INSERT INTO admin_sent_mail (id,recipient,subject,status,created_at,updated_at,from_email,from_name,reply_to,text_body,error_code) VALUES (?,?,?,'sending',?,?,?,?,?,?,NULL)").bind(id,to,subject,now,now,from,name,session.email,textBody).run();
 try{await sendSesEmail({connect,env,to,subject,text:textBody,fromEmail:from,fromName:name,replyTo:session.email});await env.AUTH_DB.prepare("UPDATE admin_sent_mail SET status='accepted',updated_at=? WHERE id=?").bind(Date.now(),id).run();return json({id,status:"accepted",message:"SES accepted the SMTP submission; inbox delivery is not confirmed."});}
 catch(e){const status=e?.deliveryOutcome==="unknown"?"unknown":"failed";await env.AUTH_DB.prepare("UPDATE admin_sent_mail SET status=?,updated_at=?,error_code=? WHERE id=?").bind(status,Date.now(),status==="unknown"?"delivery_outcome_unknown":"delivery_not_accepted",id).run();return json({id,status,error:"Submission did not complete. See Unsuccessful."},status==="unknown"?202:502);}
}

async function handle(request, env) {
  const url = new URL(request.url);

  if (url.pathname === "/api/admin/mail" || url.pathname.startsWith("/api/admin/mail/")) return adminMailboxRoute(request,env,await sessionFor(request,env));
  if (url.pathname === "/api/admin/send") return adminSendRoute(request,env,await sessionFor(request,env),connect);

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
  if (url.pathname.startsWith("/api/v1/")) return json({ error: "Account-specific endpoint required. Use the API base URL shown in your LeadMASTER account." }, 404);
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
