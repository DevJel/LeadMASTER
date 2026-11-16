import { sendThroughEmailCoordinator } from "./email-coordinator-client.mjs";

const DEFAULT_APP_URL = "https://leadmaster.jelvan.space";
const DEFAULT_REPOSITORY = "DevJel/LeadMASTER";
const DEFAULT_CF_ACCOUNT = "967aa086112f862ba9f50ccf7aa09246";
const DEFAULT_TIME_ZONE = "Asia/Manila";
const EXPECTED_TABLES = [
  "accounts", "account_members", "auth_challenges", "auth_sessions",
  "admin_sent_mail", "mail_notifications", "email_templates", "inbound_mail",
  "email_delivery_events", "developer_api_keys", "developer_email_requests",
  "developer_webhooks", "leadmaster_records", "leadmaster_reporter_runs"
];

const COLORS = {
  "Healthy": "#16834a",
  "Fixed": "#16834a",
  "Moderate": "#c58a12",
  "Needs Attention": "#e36b25",
  "Needs Manual Action": "#c62828",
  "Unable to Fix": "#991b1b"
};

const encoder = new TextEncoder();

function safeString(value, max = 500) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[ch]);
}
function statusColor(status) { return COLORS[status] || "#64748b"; }
function statusRank(status) {
  return ({ "Healthy": 0, "Fixed": 1, "Moderate": 2, "Needs Attention": 3, "Needs Manual Action": 4, "Unable to Fix": 5 })[status] ?? 3;
}
function makeCheck(area, name, status, detail, action = "", url = "") {
  return {
    area: safeString(area, 80),
    name: safeString(name, 140),
    status,
    detail: safeString(detail, 700),
    action: safeString(action, 500),
    url: typeof url === "string" && /^https:\/\//i.test(url) ? url : ""
  };
}
function getLocalDate(timestamp, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date(timestamp));
  const values = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return values.year + "-" + values.month + "-" + values.day;
}
function formatReportDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  const formatted = new Intl.DateTimeFormat("en", {
    weekday: "long", month: "short", day: "numeric", year: "numeric",
    timeZone: "UTC"
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
  return formatted.replace("Jan ", "Jan. ").replace("Feb ", "Feb. ").replace("Mar ", "Mar. ").replace("Apr ", "Apr. ").replace("Jun ", "Jun. ").replace("Jul ", "Jul. ").replace("Aug ", "Aug. ").replace("Sep ", "Sep. ").replace("Oct ", "Oct. ").replace("Nov ", "Nov. ").replace("Dec ", "Dec. ");
}
function timeoutSignal(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}
async function fetchResponse(url, init = {}, timeoutMs = 9000) {
  const timeout = timeoutSignal(timeoutMs);
  try {
    return await fetch(url, { ...init, signal: timeout.signal, redirect: "manual" });
  } finally {
    timeout.clear();
  }
}
async function fetchJson(url, init = {}, timeoutMs = 9000) {
  const response = await fetchResponse(url, init, timeoutMs);
  let body = null;
  try { body = await response.json(); } catch {}
  return { response, body };
}
async function retryProbe(run) {
  let firstError = "";
  try {
    const first = await run();
    if (first.ok) return { ...first, status: "Healthy" };
    firstError = first.detail || "The first verification attempt did not pass.";
  } catch (error) {
    firstError = safeString(error?.message || error, 300);
  }
  await new Promise(resolve => setTimeout(resolve, 350));
  try {
    const second = await run();
    if (second.ok) return { ...second, status: "Fixed", detail: "Recovered on the automatic verification retry. " + safeString(second.detail || "", 300) };
    return { ...second, status: second.status || "Needs Attention", detail: safeString(second.detail || firstError, 600) };
  } catch (error) {
    return { ok: false, status: "Needs Attention", detail: safeString(error?.message || error || firstError, 600) };
  }
}
function addResult(checks, area, name, result, action = "", url = "") {
  checks.push(makeCheck(area, name, result.status || (result.ok ? "Healthy" : "Needs Attention"), result.detail, action, url));
}
async function checkHttpRoute(url, expectedStatus, name) {
  const result = await retryProbe(async () => {
    const response = await fetchResponse(url, { method: "GET", headers: { "accept": "application/json,text/html" } });
    const ok = response.status === expectedStatus;
    const location = response.headers.get("location") || "";
    const detail = name === "Protected dashboard gate"
      ? "Unauthenticated request returned HTTP " + response.status + (location ? " and redirected to " + location : ".")
      : "Expected HTTP " + expectedStatus + "; received HTTP " + response.status + ".";
    return { ok, detail, status: ok ? "Healthy" : "Needs Attention" };
  });
  return result;
}
async function secretValue(binding) {
  try {
    const value = typeof binding?.get === "function" ? await binding.get() : binding;
    return typeof value === "string" && value.trim() ? value.trim() : null;
  } catch { return null; }
}
async function adminRecipient(env) {
  const value = await secretValue(env.ADMIN_EMAIL);
  const email = String(value || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}
async function checkApplication(env, checks) {
  const base = String(env.REPORTER_APP_URL || DEFAULT_APP_URL).replace(/\/+$/, "");
  const routeSpecs = [
    ["/", 200, "Public application landing page"],
    ["/login.html", 200, "Administrator login page"],
    ["/api/auth/config", 200, "Public authentication configuration"],
    ["/api/auth/session", 200, "Session endpoint"],
    ["/dashboard", 302, "Protected dashboard gate"],
    ["/api/workspace/actions", 401, "Workspace records authorization"],
    ["/api/admin/mail?folder=inbox", 401, "Inbox feed authorization"],
    ["/api/admin/mail?folder=sent", 401, "Sent mail feed authorization"],
    ["/api/admin/mail?folder=deleted", 401, "Deleted mail feed authorization"],
    ["/api/admin/unsubscribes", 401, "Unsubscribe management authorization"],
    ["/api/admin/templates", 401, "Template management authorization"],
    ["/api/admin/send", 401, "Email sending authorization"],
    ["/api/admin/send-batches", 401, "Sending batch authorization"],
    ["/api/admin/activity", 401, "Activity authorization"],
    ["/api/admin/notifications", 401, "Notification authorization"],
    ["/api/admin/audience", 401, "Audience management authorization"],
    ["/api/admin/webhooks", 401, "Webhook management authorization"],
    ["/api/account/profile", 401, "Admin profile authorization"],
    ["/api/developer/keys", 401, "Developer key authorization"]
  ];
  const routeResults = await Promise.all(routeSpecs.map(async ([path, expected, name]) => ({
    path, expected, name, result: await checkHttpRoute(base + path, expected, name)
  })));
  for (const item of routeResults) {
    const action = item.result.ok ? "" : "Inspect the deployed route, authentication middleware and Worker logs; do not weaken the expected authorization response.";
    addResult(checks, "App Functions", item.name, item.result, action, base + item.path);
  }
  const auth = routeResults.find(x => x.path === "/api/auth/config");
  if (auth?.result.ok) {
    const data = await retryProbe(async () => {
      const { response, body } = await fetchJson(base + "/api/auth/config", { headers: { accept: "application/json" } });
      const ok = response.status === 200 && typeof body?.turnstileSiteKey === "string" && body.turnstileSiteKey.length > 10;
      return { ok, detail: ok ? "Turnstile public configuration is present; the secret key is never read or included in the report." : "Authentication configuration is missing the expected public Turnstile site key." };
    });
    addResult(checks, "App Functions", "Turnstile configuration", data, "If unhealthy, restore the existing Turnstile secret-store binding and site-key configuration; never expose the secret key.", base + "/api/auth/config");
  }
  return base;
}
async function checkDatabase(env, checks) {
  if (!env.AUTH_DB || typeof env.AUTH_DB.prepare !== "function") {
    checks.push(makeCheck("Cloudflare Runtime", "D1 database binding", "Unable to Fix", "AUTH_DB is not available in this Worker runtime.", "Restore the AUTH_DB D1 binding in the LeadMASTER Worker configuration."));
    return;
  }
  try {
    const rows = await env.AUTH_DB.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
    const names = new Set((rows.results || []).map(row => String(row.name)));
    const missing = EXPECTED_TABLES.filter(name => !names.has(name));
    if (missing.length) {
      checks.push(makeCheck("Cloudflare Runtime", "D1 schema integrity", "Needs Attention", "Missing required tables: " + missing.join(", "), "Review the matching repository migrations and apply the missing additive migrations before app features are used."));
    } else {
      checks.push(makeCheck("Cloudflare Runtime", "D1 schema integrity", "Healthy", EXPECTED_TABLES.length + " required application and reporter tables are present and queryable."));
    }
    checks.push(makeCheck("Cloudflare Runtime", "D1 query connectivity", "Healthy", "A read-only sqlite_master query completed successfully; no mailbox contents were read."));
  } catch (error) {
    checks.push(makeCheck("Cloudflare Runtime", "D1 database", "Needs Attention", safeString(error?.message || error, 500), "Check D1 availability, binding configuration and migration state."));
  }
}
async function checkEmailCoordinator(env, checks) {
  if (!env.EMAIL_COORDINATOR || typeof env.EMAIL_COORDINATOR.idFromName !== "function" || typeof env.EMAIL_COORDINATOR.get !== "function") {
    checks.push(makeCheck("Cloudflare Runtime", "SES email coordinator binding", "Unable to Fix", "The EMAIL_COORDINATOR Durable Object binding is unavailable.", "Restore the existing EmailCoordinator binding and its deployed class."));
    return;
  }
  try {
    const stub = env.EMAIL_COORDINATOR.get(env.EMAIL_COORDINATOR.idFromName("ses-global"));
    const response = await stub.fetch("https://email-coordinator.internal/health", { method: "GET" });
    const body = await response.json();
    const ok = response.ok && body?.status === "healthy" && body?.smtpConfigured === true && body?.fromConfigured === true;
    checks.push(makeCheck("Cloudflare Runtime", "SES SMTP transport", ok ? "Healthy" : "Needs Attention",
      ok ? "The shared LeadMASTER SES coordinator confirms its SMTP host, username, password and sender configuration are present. No credentials are exposed and no test email was sent."
        : "The shared SES coordinator is reachable but its health check reports incomplete SMTP configuration.",
      ok ? "" : "Check the existing SES Secrets Store bindings and EmailCoordinator deployment."));
  } catch (error) {
    checks.push(makeCheck("Cloudflare Runtime", "SES SMTP transport", "Needs Attention", safeString(error?.message || error, 500), "Inspect the EmailCoordinator Durable Object deployment and existing SES secret bindings."));
  }
}
async function checkR2AndBindings(env, checks) {
  if (!env.INBOUND_MAIL || typeof env.INBOUND_MAIL.list !== "function") {
    checks.push(makeCheck("Cloudflare Runtime", "Inbound mail R2 binding", "Unable to Fix", "INBOUND_MAIL bucket binding is missing.", "Restore the existing leadmaster-inbound-mail R2 binding."));
  } else {
    try {
      await env.INBOUND_MAIL.list({ limit: 1 });
      checks.push(makeCheck("Cloudflare Runtime", "Inbound mail R2 access", "Healthy", "The inbound-mail bucket is reachable. The report does not inspect message contents or attachments."));
    } catch (error) {
      checks.push(makeCheck("Cloudflare Runtime", "Inbound mail R2 access", "Needs Attention", safeString(error?.message || error, 500), "Check the R2 bucket binding and bucket availability."));
    }
  }
  checks.push(makeCheck("Cloudflare Runtime", "Email send Queue binding", env.MAIL_SEND_QUEUE && typeof env.MAIL_SEND_QUEUE.send === "function" ? "Healthy" : "Unable to Fix",
    env.MAIL_SEND_QUEUE && typeof env.MAIL_SEND_QUEUE.send === "function" ? "The production send-queue producer binding is available. Queue consumer wiring and backlog are checked through the Cloudflare API audit." : "MAIL_SEND_QUEUE binding is missing.",
    env.MAIL_SEND_QUEUE ? "" : "Restore the leadmaster-mail-send producer binding."));
  checks.push(makeCheck("Cloudflare Runtime", "Auto-Heal KV binding", env.AUTO_HEAL_KV && typeof env.AUTO_HEAL_KV.get === "function" && typeof env.AUTO_HEAL_KV.put === "function" ? "Healthy" : "Unable to Fix",
    env.AUTO_HEAL_KV && typeof env.AUTO_HEAL_KV.get === "function" && typeof env.AUTO_HEAL_KV.put === "function" ? "The error-hash deduplication and rejected-fix KV namespace is bound." : "AUTO_HEAL_KV binding is missing.",
    env.AUTO_HEAL_KV ? "" : "Restore the leadmaster-auto-heal KV namespace binding."));
  checks.push(makeCheck("Cloudflare Runtime", "Workers AI binding", env.AI && typeof env.AI.run === "function" ? "Healthy" : "Moderate",
    env.AI && typeof env.AI.run === "function" ? "Workers AI binding is configured. No model inference is executed by the scheduled health check." : "AI binding is not available in the Worker runtime.",
    env.AI ? "" : "If AI reply suggestions are expected to be active, restore the existing AI binding."));
}
function githubHeaders(env) {
  const headers = { accept: "application/vnd.github+json", "user-agent": "LeadMASTER-Reporter/1.0", "x-github-api-version": "2022-11-28" };
  if (typeof env.GITHUB_TOKEN === "string" && env.GITHUB_TOKEN.trim()) headers.authorization = "Bearer " + env.GITHUB_TOKEN.trim();
  return headers;
}
async function githubJson(url, env) {
  const { response, body } = await fetchJson(url, { headers: githubHeaders(env) });
  if (!response.ok) throw new Error("GitHub API returned HTTP " + response.status + (body?.message ? ": " + safeString(body.message, 160) : ""));
  return body;
}
async function checkGitHub(env, checks) {
  const repo = String(env.REPORTER_GITHUB_REPOSITORY || DEFAULT_REPOSITORY);
  const base = "https://api.github.com/repos/" + repo;
  let repository = null;
  try {
    repository = await githubJson(base, env);
    const branchName = repository.default_branch || "main";
    const branch = await githubJson(base + "/branches/" + encodeURIComponent(branchName), env);
    checks.push(makeCheck("GitHub", "Repository and default branch", "Healthy",
      repo + " is reachable; default branch " + branchName + " points to " + safeString(branch.commit?.sha || "", 12) + ".",
      "", "https://github.com/" + repo));
  } catch (error) {
    checks.push(makeCheck("GitHub", "Repository access", "Needs Manual Action", safeString(error?.message || error, 500),
      "Confirm the repository is accessible. If private or rate-limited, configure a least-privilege GITHUB_TOKEN Worker secret.", "https://github.com/" + repo));
  }
  try {
    const result = await githubJson(base + "/actions/runs?branch=main&per_page=20", env);
    const runs = Array.isArray(result.workflow_runs) ? result.workflow_runs : [];
    if (!runs.length) {
      checks.push(makeCheck("GitHub", "GitHub Actions", "Moderate", "No workflow runs were returned for main.", "Confirm Actions are enabled and workflow files are present.", "https://github.com/" + repo + "/actions"));
    } else {
      const latestByName = new Map();
      for (const run of runs) {
        if (!latestByName.has(run.name)) latestByName.set(run.name, run);
      }
      for (const [name, run] of latestByName) {
        let status = "Healthy";
        let detail = "Latest run on main completed successfully (" + safeString(run.head_sha || "", 12) + ").";
        let action = "";
        if (run.status !== "completed") {
          status = "Moderate";
          detail = "Latest run is currently " + safeString(run.status) + ".";
          action = "Review the run if it remains queued or in progress beyond its normal duration.";
        } else if (run.conclusion !== "success") {
          status = "Needs Attention";
          detail = "Latest run concluded " + safeString(run.conclusion || "unknown") + ".";
          action = "Open the failed job logs, correct the root cause and rerun the failed checks. The reporter does not push code or deploy automatically.";
        }
        checks.push(makeCheck("GitHub Actions", name, status, detail, action, run.html_url || "https://github.com/" + repo + "/actions"));
      }
    }
  } catch (error) {
    checks.push(makeCheck("GitHub Actions", "Workflow run monitoring", "Needs Manual Action", safeString(error?.message || error, 500),
      "Check repository Actions access, GitHub API rate limits and the optional GITHUB_TOKEN secret.", "https://github.com/" + repo + "/actions"));
  }
  try {
    const issues = await githubJson(base + "/issues?state=open&per_page=50", env);
    const actualIssues = (Array.isArray(issues) ? issues : []).filter(item => !item.pull_request);
    const critical = actualIssues.filter(item => (item.labels || []).some(label => /bug|security|production|regression|incident/i.test(label.name || "")));
    const status = critical.length ? "Needs Attention" : actualIssues.length ? "Moderate" : "Healthy";
    const detail = actualIssues.length
      ? actualIssues.slice(0, 12).map(item => "#" + item.number + " " + safeString(item.title, 140)).join(" · ")
      : "No open GitHub issues were found.";
    checks.push(makeCheck("GitHub", "Open repository issues", status, detail,
      critical.length ? "Review production/security/bug-labelled issues and assign a fix owner." : actualIssues.length ? "Review open issues and confirm whether any affect the deployed application." : "",
      "https://github.com/" + repo + "/issues"));
  } catch (error) {
    checks.push(makeCheck("GitHub", "Open repository issues", "Needs Manual Action", safeString(error?.message || error, 400),
      "Verify GitHub repository read access and API rate limits.", "https://github.com/" + repo + "/issues"));
  }
  try {
    const pulls = await githubJson(base + "/pulls?state=open&per_page=30", env);
    const open = Array.isArray(pulls) ? pulls : [];
    checks.push(makeCheck("GitHub", "Open pull requests", open.length ? "Moderate" : "Healthy",
      open.length ? open.slice(0, 10).map(item => "#" + item.number + " " + safeString(item.title, 130) + (item.draft ? " (draft)" : "")).join(" · ") : "No open pull requests.",
      open.length ? "Review CI, approvals and merge readiness before release." : "", "https://github.com/" + repo + "/pulls"));
  } catch (error) {
    checks.push(makeCheck("GitHub", "Open pull requests", "Needs Manual Action", safeString(error?.message || error, 400),
      "Verify GitHub repository read access and API rate limits.", "https://github.com/" + repo + "/pulls"));
  }
}
async function cloudflareApi(path, token) {
  const response = await fetchResponse("https://api.cloudflare.com/client/v4" + path, {
    headers: { authorization: "Bearer " + token, accept: "application/json" }
  }, 10000);
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) {
    const message = (body.errors || []).map(error => error.message).join("; ");
    throw new Error("Cloudflare API HTTP " + response.status + (message ? ": " + safeString(message, 220) : ""));
  }
  return body.result;
}
async function checkCloudflareControlPlane(env, checks) {
  const token = typeof env.CF_API_TOKEN === "string" ? env.CF_API_TOKEN.trim() : "";
  if (!token) {
    checks.push(makeCheck("Cloudflare", "Account-level resource audit", "Needs Manual Action",
      "Runtime checks can verify the live Worker, D1, R2, Queue binding and SES coordinator, but account-wide Worker deployments, cron schedules, Queue consumer wiring and resource inventory cannot be queried without a scoped Cloudflare API token.",
      "Create a read-only API token scoped only to the Lead Master Web App account with Workers Scripts Read, D1 Read, Queues Read and Workers R2 Storage Read permissions. Add it as the LeadMASTER Worker secret CF_API_TOKEN. Never use a Global API Key."));
    return;
  }
  const account = String(env.REPORTER_CF_ACCOUNT_ID || DEFAULT_CF_ACCOUNT);
  try {
    const [scripts, databases, queues, buckets, schedules, deployments] = await Promise.all([
      cloudflareApi("/accounts/" + account + "/workers/scripts", token),
      cloudflareApi("/accounts/" + account + "/d1/database", token),
      cloudflareApi("/accounts/" + account + "/queues", token),
      cloudflareApi("/accounts/" + account + "/r2/buckets", token),
      cloudflareApi("/accounts/" + account + "/workers/scripts/leadmaster/schedules", token),
      cloudflareApi("/accounts/" + account + "/workers/scripts/leadmaster/deployments", token)
    ]);
    const worker = (scripts || []).find(item => item.id === "leadmaster");
    checks.push(makeCheck("Cloudflare", "LeadMASTER Worker deployment", worker ? "Healthy" : "Unable to Fix",
      worker ? "Worker exists; deployed tag " + safeString(worker.tag || "unknown", 80) + "; handlers: " + (worker.handlers || []).join(", ") + "." : "The leadmaster Worker script is missing.",
      worker ? "" : "Restore the LeadMASTER Worker from the main branch after reviewing deployment history."));
    const dbList = Array.isArray(databases) ? databases : [];
    const db = dbList.find(item => item.name === "leadmaster-auth");
    checks.push(makeCheck("Cloudflare", "D1 resource inventory", db ? "Healthy" : "Needs Attention",
      db ? "leadmaster-auth exists (" + safeString(db.uuid, 60) + ")." : "The expected leadmaster-auth D1 database was not found.",
      db ? "" : "Restore the expected D1 binding/database; do not create a replacement without checking backups."));
    const queueList = Array.isArray(queues) ? queues : [];
    const sendQueue = queueList.find(item => item.queue_name === "leadmaster-mail-send");
    const producerOk = !!sendQueue && (sendQueue.producers || []).some(item => item.script === "leadmaster");
    const consumerOk = !!sendQueue && (sendQueue.consumers || []).some(item => item.script === "leadmaster-mail-queue-consumer");
    checks.push(makeCheck("Cloudflare", "Mail Queue producer and consumer", producerOk && consumerOk ? "Healthy" : "Needs Attention",
      sendQueue ? "Queue exists. Producer: " + (producerOk ? "connected" : "missing") + "; consumer: " + (consumerOk ? "connected" : "missing") + "." : "leadmaster-mail-send queue was not found.",
      producerOk && consumerOk ? "" : "Reconnect the expected Worker producer and queue consumer; inspect queue backlog and dead-letter messages."));
    const bucketList = Array.isArray(buckets?.buckets) ? buckets.buckets : Array.isArray(buckets) ? buckets : [];
    const bucket = bucketList.find(item => item.name === "leadmaster-inbound-mail");
    checks.push(makeCheck("Cloudflare", "Inbound mail R2 inventory", bucket ? "Healthy" : "Needs Attention",
      bucket ? "leadmaster-inbound-mail bucket exists." : "The expected inbound-mail bucket was not found.",
      bucket ? "" : "Restore the inbound-mail bucket and its binding."));
    const cronList = schedules?.schedules || [];
    const cronOk = cronList.some(item => item.cron === "0 9 * * *");
    checks.push(makeCheck("Cloudflare", "Daily Reporter Cron Trigger", cronOk ? "Healthy" : "Needs Attention",
      cronOk ? "Mandatory daily report is configured for 09:00 UTC (17:00 Asia/Manila)." : "The expected daily 09:00 UTC / 17:00 Asia/Manila cron trigger is missing.",
      cronOk ? "" : "Deploy the latest main branch configuration with the daily reporter cron."));
    const latest = deployments?.deployments?.[0];
    checks.push(makeCheck("Cloudflare", "Latest Worker deployment", latest ? "Healthy" : "Moderate",
      latest ? "Latest deployment " + safeString(latest.id, 60) + " created " + safeString(latest.created_on, 60) + "." : "No Worker deployment history was returned.",
      latest ? "" : "Review Worker deployment history in Cloudflare."));
  } catch (error) {
    checks.push(makeCheck("Cloudflare", "Account-level resource audit", "Needs Manual Action", safeString(error?.message || error, 600),
      "Confirm CF_API_TOKEN is valid and has the required read-only permissions for Workers, D1, Queues and R2."));
  }
}
function summarize(checks) {
  const counts = { "Healthy": 0, "Fixed": 0, "Moderate": 0, "Needs Attention": 0, "Needs Manual Action": 0, "Unable to Fix": 0 };
  for (const check of checks) counts[check.status] = (counts[check.status] || 0) + 1;
  const failed = checks.filter(check => statusRank(check.status) >= statusRank("Needs Attention"));
  const overall = checks.some(x => x.status === "Unable to Fix") ? "Unable to Fix"
    : checks.some(x => x.status === "Needs Manual Action") ? "Needs Manual Action"
    : checks.some(x => x.status === "Needs Attention") ? "Needs Attention"
    : counts.Moderate ? "Moderate" : counts.Fixed ? "Fixed" : "Healthy";
  return { counts, total: checks.length, overall, failed };
}
function renderTable(title, checks) {
  const rows = checks.length ? checks.map(item => {
    const color = statusColor(item.status);
    const name = escapeHtml(item.name);
    const detail = escapeHtml(item.detail);
    const action = item.action ? '<div style="margin-top:6px;color:#475569;font-size:12px"><strong>Action:</strong> ' + escapeHtml(item.action) + '</div>' : "";
    const link = item.url ? '<div style="margin-top:5px"><a href="' + escapeHtml(item.url) + '" style="color:#b45309;text-decoration:none;font-size:12px">Open source ↗</a></div>' : "";
    return '<tr><td style="padding:13px 14px;border-bottom:1px solid #e5e7eb;vertical-align:top;width:25%"><strong style="font-size:13px;color:#111827">' + name + '</strong></td><td style="padding:13px 14px;border-bottom:1px solid #e5e7eb;vertical-align:top;width:18%"><span style="display:inline-block;padding:4px 8px;border-radius:999px;background:' + color + '18;color:' + color + ';font-size:11px;font-weight:700">' + escapeHtml(item.status) + '</span></td><td style="padding:13px 14px;border-bottom:1px solid #e5e7eb;vertical-align:top;color:#475569;font-size:13px;line-height:1.55">' + detail + action + link + '</td></tr>';
  }).join("") : '<tr><td colspan="3" style="padding:16px;color:#64748b">No checks were recorded in this section.</td></tr>';
  return '<h2 style="margin:28px 0 10px;font-size:17px;line-height:23px;color:#111827">' + escapeHtml(title) + '</h2><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #e5e7eb;border-collapse:collapse;background:#fff"><tr style="background:#f3f4f6"><th align="left" style="padding:10px 14px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#64748b">Check</th><th align="left" style="padding:10px 14px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#64748b">Status</th><th align="left" style="padding:10px 14px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#64748b">Findings and required action</th></tr>' + rows + '</table>';
}
function renderHtml(dateLabel, checks, summary) {
  const color = statusColor(summary.overall);
  const metrics = Object.entries(summary.counts).map(([label, count]) => '<td align="center" style="padding:12px 6px;border:1px solid #e5e7eb;background:#fff"><div style="font-size:22px;font-weight:700;color:' + statusColor(label) + '">' + count + '</div><div style="font-size:10px;color:#64748b">' + escapeHtml(label) + '</div></td>').join("");
  const github = checks.filter(x => x.area.startsWith("GitHub"));
  const cloudflare = checks.filter(x => x.area.startsWith("Cloudflare"));
  const app = checks.filter(x => x.area === "App Functions");
  const runtime = checks.filter(x => x.area === "Cloudflare Runtime");
  const action = checks.filter(x => statusRank(x.status) >= statusRank("Needs Attention"));
  const actionsHtml = action.length ? '<div style="margin:20px 0;padding:16px 18px;border-left:4px solid #c62828;background:#fff7f7"><strong style="display:block;margin-bottom:8px;color:#991b1b">Actions requiring attention</strong><ul style="margin:0;padding-left:18px;color:#374151;font-size:13px;line-height:1.65">' + action.map(x => '<li><strong>' + escapeHtml(x.name) + ' — ' + escapeHtml(x.status) + ':</strong> ' + escapeHtml(x.action || x.detail) + '</li>').join("") + '</ul></div>' : '<div style="margin:20px 0;padding:14px 16px;border-left:4px solid #16834a;background:#f0fdf4;color:#166534;font-size:13px">No unresolved critical or manual-action findings were recorded.</div>';
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>REPORT OF THE DAY — ' + escapeHtml(dateLabel) + '</title></head><body style="margin:0;padding:0;background:#f3f4f6;color:#111827;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="760" cellpadding="0" cellspacing="0" style="width:100%;max-width:760px;background:#fff;border-top:4px solid #111827"><tr><td style="padding:26px 30px 18px;border-bottom:1px solid #e5e7eb"><div style="font-size:20px;font-weight:800;letter-spacing:.06em;color:#111827">LeadMASTER</div><div style="margin-top:7px;font-size:11px;letter-spacing:.16em;font-weight:700;color:#d97706">REPORTER / WORKER · DAILY OPERATIONS</div></td></tr><tr><td style="padding:28px 30px 8px"><div style="font-size:11px;letter-spacing:.12em;font-weight:700;color:#d97706">REPORT OF THE DAY</div><h1 style="margin:7px 0 16px;font-size:26px;line-height:1.25;color:#111827">' + escapeHtml(dateLabel) + '</h1><p style="margin:0 0 12px;font-size:15px;color:#111827">Hi Admin,</p><p style="margin:0;font-size:14px;line-height:1.7;color:#475569">This is LEADMASTER Reporter/Worker. Below is the daily operational review of the app functions, GitHub repository, Cloudflare resources and backend services. Findings are based on read-only checks unless a safe automatic retry is explicitly recorded.</p><div style="margin:20px 0;padding:15px 17px;background:#f8fafc;border:1px solid #e5e7eb"><div style="font-size:11px;letter-spacing:.1em;color:#64748b;font-weight:700">OVERALL STATUS</div><div style="margin-top:6px;font-size:18px;font-weight:800;color:' + color + '">' + escapeHtml(summary.overall) + '</div><div style="margin-top:4px;font-size:12px;color:#64748b">' + summary.total + ' checks completed · ' + summary.failed.length + ' require attention or manual action</div></div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>' + metrics + '</tr></table>' + actionsHtml + renderTable("GITHUB — REPOSITORY AND ACTIONS", github) + renderTable("CLOUDFLARE — ACCOUNT AND RUNTIME", [...cloudflare, ...runtime]) + renderTable("APP FUNCTIONS AFFECTED", app) + renderTable("INCIDENT AND REPORTER", checks.filter(x => x.area === "Incident" || x.area === "Reporter")) + '<h2 style="margin:28px 0 10px;font-size:17px;color:#111827">Status legend</h2><p style="margin:0;color:#475569;font-size:12px;line-height:1.8"><span style="color:#16834a;font-weight:700">Green — Healthy / Fixed</span> &nbsp; <span style="color:#c58a12;font-weight:700">Yellow — Moderate</span> &nbsp; <span style="color:#e36b25;font-weight:700">Orange — Needs Attention</span> &nbsp; <span style="color:#c62828;font-weight:700">Red — Needs Manual Action</span> &nbsp; <span style="color:#991b1b;font-weight:700">Dark red — Unable to Fix</span></p><p style="margin:24px 0 0;font-size:13px;line-height:1.7;color:#475569">Please review the actions above and make changes where applicable. The Reporter/Worker retries transient checks and verifies the result; it does not silently change application code, production data, account security settings or deployments.</p><p style="margin:20px 0 0;color:#111827;font-size:13px">Reporter/Worker,<br><strong>LeadMASTER</strong></p></td></tr><tr><td style="padding:18px 30px;background:#f8fafc;border-top:1px solid #e5e7eb;color:#64748b;font-size:11px;line-height:1.6">This is an automatically generated operational email by the LeadMASTER Reporter/Worker. It is sent only to the configured primary administrator. It does not include credentials, passwords, OTPs, private message contents or SMTP secrets. A green infrastructure check is not a guarantee of email inbox placement or end-user experience. Please do not reply to this automated report.<br><br>© ' + new Date().getUTCFullYear() + ' LeadMASTER · Operational monitoring</td></tr></table></td></tr></table></body></html>';
}
function renderText(dateLabel, checks, summary) {
  const sections = ["GitHub", "GitHub Actions", "Cloudflare", "Cloudflare Runtime", "App Functions", "Incident", "Reporter"];
  const lines = ["REPORT OF THE DAY — " + dateLabel, "", "Hi Admin,", "", "This is LEADMASTER Reporter/Worker. Please review the app functions, GitHub and Cloudflare checks below.", "", "OVERALL: " + summary.overall, "Checks: " + summary.total, ...Object.entries(summary.counts).map(([name, count]) => name + ": " + count), ""];
  for (const section of sections) {
    const items = checks.filter(x => x.area === section || (section === "GitHub" && x.area === "GitHub") || (section === "Cloudflare" && x.area === "Cloudflare"));
    if (!items.length) continue;
    lines.push(section.toUpperCase());
    for (const item of items) lines.push("- [" + item.status + "] " + item.name + ": " + item.detail + (item.action ? " Action: " + item.action : "") + (item.url ? " " + item.url : ""));
    lines.push("");
  }
  lines.push("Reporter/Worker,", "LeadMASTER", "", "This is an autogenerated operational report. It is sent only to the configured primary administrator. Do not reply.");
  return lines.join("\n");
}
async function persistRun(env, date, state) {
  const json = JSON.stringify(state.report || {});
  await env.AUTH_DB.prepare(
    "UPDATE leadmaster_reporter_runs SET status=?, completed_at=?, total_checks=?, healthy_count=?, fixed_count=?, moderate_count=?, attention_count=?, manual_count=?, unable_count=?, email_status=?, email_message_id=?, report_json=?, error_summary=? WHERE report_date=?"
  ).bind(
    state.status, state.completedAt || null, state.summary?.total || 0,
    state.summary?.counts?.Healthy || 0, state.summary?.counts?.Fixed || 0,
    state.summary?.counts?.Moderate || 0, state.summary?.counts?.["Needs Attention"] || 0,
    state.summary?.counts?.["Needs Manual Action"] || 0, state.summary?.counts?.["Unable to Fix"] || 0,
    state.emailStatus || "not_attempted", state.messageId || null, json,
    state.error ? safeString(state.error, 1000) : null, date
  ).run();
}
export async function runDailyReporter(env, scheduledTime = Date.now(), options = {}) {
  const timeZone = String(env.REPORTER_TIME_ZONE || DEFAULT_TIME_ZONE);
  const reportDate = getLocalDate(Number(scheduledTime) || Date.now(), timeZone);
  const dateLabel = formatReportDate(reportDate);
  const reportKey = options.incidentId
    ? reportDate + "-incident-" + safeString(options.incidentId, 48).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 48)
    : options.sample ? reportDate + "-sample-" + safeString(options.sampleId || crypto.randomUUID(), 36).replace(/[^A-Za-z0-9_-]/g, "") : reportDate;
  const reportId = "leadmaster-" + (options.incidentId ? "incident-" : options.sample ? "sample-" : "daily-report-") + reportKey;
  const now = Date.now();
  const existing = await env.AUTH_DB.prepare("SELECT status,email_status,started_at FROM leadmaster_reporter_runs WHERE report_date=?").bind(reportKey).first();
  if (existing?.email_status === "accepted" || existing?.email_status === "unknown" || existing?.status === "running") {
    return { skipped: true, reason: "already_attempted", reportDate, emailStatus: existing.email_status };
  }
  if (existing && existing.email_status !== "not_accepted" && !options.manual) {
    return { skipped: true, reason: "already_attempted", reportDate, emailStatus: existing.email_status };
  }
  await env.AUTH_DB.prepare(
    "INSERT INTO leadmaster_reporter_runs (id,report_date,status,started_at,email_status,report_json) VALUES (?,?, 'running', ?, 'not_attempted', '{}') ON CONFLICT(report_date) DO UPDATE SET status='running',started_at=excluded.started_at,completed_at=NULL,error_summary=NULL WHERE leadmaster_reporter_runs.email_status='not_accepted'"
  ).bind(reportId, reportKey, now).run();
  const current = await env.AUTH_DB.prepare("SELECT status,email_status,started_at FROM leadmaster_reporter_runs WHERE report_date=?").bind(reportKey).first();
  if (!current || current.status !== "running" || Number(current.started_at) !== now) return { skipped: true, reason: "another_run_in_progress", reportDate };
  const checks = [];
  try {
    if (options.incident) {
      checks.push(makeCheck("Incident", "Triggered event", options.incident.status === "pr_opened" ? "Needs Manual Action" : "Needs Attention",
        "Event: " + safeString(options.incident.eventType || "GitHub incident") + ". Result: " + safeString(options.incident.status || "investigated") + ". " + safeString(options.incident.reason || options.incident.prUrl || "The event was investigated by the bounded auto-heal worker.", 450),
        options.incident.prUrl ? "Review the draft pull request; it cannot merge or deploy itself." : "Review the linked issue and apply a manual fix if required.",
        options.incident.prUrl || options.incident.issueUrl || ""));
    }
    if (options.sample) checks.push(makeCheck("Reporter", "Sample report", "Healthy", "This is a one-time sample of the configured daily report layout and checks."));
    await checkApplication(env, checks);
    await Promise.all([
      checkDatabase(env, checks),
      checkEmailCoordinator(env, checks),
      checkR2AndBindings(env, checks),
      checkGitHub(env, checks),
      checkCloudflareControlPlane(env, checks)
    ]);
    const smtpCheck = checks.find(item => item.name === "SES SMTP transport");
    const loginAlertStatus = smtpCheck?.status === "Healthy" || smtpCheck?.status === "Fixed" ? "Healthy" : "Needs Attention";
    checks.push(makeCheck("App Functions", "Admin login security alert", loginAlertStatus,
      "The existing successful-login flow sends the LeadMASTER security alert template to the configured primary administrator through the shared SES coordinator. The health check verifies the sender path, not inbox placement.",
      loginAlertStatus === "Healthy" ? "" : "Restore the shared SES coordinator and existing email-securityalert template."));
    const admin = await adminRecipient(env);
    if (!admin) {
      checks.push(makeCheck("Reporter", "Admin-only report recipient", "Unable to Fix", "The configured ADMIN_EMAIL secret is missing or invalid; the report will not be sent to any fallback recipient.", "Restore the existing ADMIN_EMAIL secret-store binding. The reporter never accepts a recipient from an HTTP request."));
    } else {
      checks.push(makeCheck("Reporter", "Admin-only recipient restriction", "Healthy", "Report recipient is the configured primary admin identity. No CC or BCC recipients are used."));
    }
    const summary = summarize(checks);
    const report = { reportDate, timeZone, generatedAt: new Date().toISOString(), overall: summary.overall, summary, checks };
    await persistRun(env, reportKey, { status: "ready_to_send", completedAt: Date.now(), summary, report, emailStatus: "not_attempted", messageId: reportId });
    if (!admin) return { reportDate, status: "not_sent", summary };
    const html = renderHtml(dateLabel, checks, summary);
    const text = renderText(dateLabel, checks, summary);
    try {
      const sent = await sendThroughEmailCoordinator(env, {
        id: reportId,
        messageId: reportId,
        to: admin,
        fromName: "LeadMASTER Reporter/Worker",
        subject: (options.incident ? "LEADMASTER INCIDENT REPORT — " : options.sample ? "LEADMASTER REPORT SAMPLE — " : "REPORT OF THE DAY — ") + dateLabel + " — " + summary.overall,
        text,
        html
      });
      const accepted = sent?.status === "accepted";
      await persistRun(env, reportKey, {
        status: accepted ? "sent" : "failed",
        completedAt: Date.now(), summary, report,
        emailStatus: accepted ? "accepted" : "unknown",
        messageId: reportId
      });
      return { reportDate, status: accepted ? "sent" : "unknown", recipient: admin, summary };
    } catch (error) {
      const outcome = error?.deliveryOutcome === "not_accepted" ? "not_accepted" : "unknown";
      await persistRun(env, reportKey, {
        status: "failed", completedAt: Date.now(), summary, report,
        emailStatus: outcome, messageId: reportId, error: safeString(error?.message || error, 500)
      });
      return { reportDate, status: outcome, summary };
    }
  } catch (error) {
    const summary = summarize(checks);
    const report = { reportDate, timeZone, generatedAt: new Date().toISOString(), overall: summary.overall, summary, checks };
    await persistRun(env, reportKey, {
      status: "failed", completedAt: Date.now(), summary, report,
      emailStatus: "not_attempted", messageId: reportId, error: safeString(error?.message || error, 800)
    });
    throw error;
  }
}
export async function reporterStatus(env, limit = 10) {
  const rows = await env.AUTH_DB.prepare(
    "SELECT report_date,status,started_at,completed_at,total_checks,healthy_count,fixed_count,moderate_count,attention_count,manual_count,unable_count,email_status,error_summary FROM leadmaster_reporter_runs ORDER BY report_date DESC LIMIT ?"
  ).bind(Math.max(1, Math.min(30, Number(limit) || 10))).all();
  return rows.results || [];
}
