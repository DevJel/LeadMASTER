const MAX_WINDOW = 40;
const MAX_CHANGED_LINES = 15;
const MAX_DIFF_LINES = 20;
const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const enc = new TextEncoder();

export const STRICT_FIX_PROMPT = `You are a surgical automated bug-fix engine. Your ONLY task is to fix the exact runtime exception provided in the stack trace.

STRICT RULES (VIOLATION = IMMEDIATE REJECTION):
1. Fix ONLY the specific crash/exception shown in the stack trace.
2. Do NOT refactor, reformat, rename variables, add comments, or optimize surrounding code.
3. Do NOT modify imports, dependencies, configuration files, or test files.
4. Keep changes minimal (under 15 lines). Use defensive guards (null checks, bounds checks, try/catch, type guards) strictly at the point of failure.
5. If the fix requires architectural changes, database migrations, or multi-file refactoring, set "can_fix_strictly": false.

Respond ONLY in valid JSON matching this schema:
{
  "can_fix_strictly": boolean,
  "confidence": number,
  "target_file": "exact/path/from/stacktrace",
  "search_code": "exact verbatim lines from provided snippet",
  "replace_code": "minimal surgical replacement",
  "scope_justification": "one sentence proving the replacement is limited to the failing line",
  "reason": "one sentence explaining the root cause"
}`;

const PROTECTED = [
  /^(?:package\.json|package-lock\.json|build\.gradle(?:\.kts)?|settings\.gradle(?:\.kts)?|gradle\.properties)$/i,
  /^\.github\//i,
  /(^|\/)(?:auth|authentication|config|configuration|secrets?)(?:[-./]|$)/i,
  /(?:^|\/)[^/]*\.(?:test|spec)\.[^.]+$/i,
  /(?:^|\/)[^/]*Test\.kt$/i,
  /^migrations\//i,
  /^(?:worker\.js|wrangler\.(?:jsonc|toml))$/i,
  /^(?:package|vite|webpack|tsconfig|tailwind|postcss)\.[^/]+$/i
];

export function isProtectedPath(path) {
  const normalized = normalizePath(path);
  return !normalized || !normalized.startsWith("src/") ||
    !/\.(?:mjs|cjs|js|ts|tsx|jsx)$/.test(normalized) ||
    PROTECTED.some(pattern => pattern.test(normalized));
}

function normalizePath(path) {
  return String(path || "").replace(/\\/g, "/").replace(/^file:\/\//, "")
    .replace(/^.*?\/LeadMASTER\//, "").replace(/^\.\//, "").replace(/^\/+/, "");
}

export function parseStackFrames(stack) {
  const frames = [];
  const lines = String(stack || "").split(/\r?\n/).slice(0, 250);
  for (const line of lines) {
    const matches = [
      line.match(/(?:at\s+.*?\()?((?:\.\.\/|\.\/)?(?:src|workers)\/[A-Za-z0-9_./-]+\.(?:mjs|cjs|js|ts|tsx|jsx)):(\d+):(\d+)\)?/),
      line.match(/((?:\.\.\/|\.\/)?(?:src|workers)\/[A-Za-z0-9_./-]+\.(?:mjs|cjs|js|ts|tsx|jsx)):(\d+)(?::(\d+))?/)
    ].filter(Boolean);
    if (!matches.length) continue;
    const match = matches[0];
    const file = normalizePath(match[1]);
    const lineNumber = Number(match[2]);
    if (!file || !Number.isInteger(lineNumber) || lineNumber < 1 || isProtectedPath(file)) continue;
    frames.push({ file, line: lineNumber, column: Number(match[3] || 0), stackLine: line.trim().slice(0, 500) });
  }
  return frames.filter((frame, index) => frames.findIndex(x => x.file === frame.file && x.line === frame.line) === index);
}

export function extractScopedWindow(source, line, radius = MAX_WINDOW) {
  const lines = String(source || "").split(/\r?\n/);
  const center = Math.max(1, Math.min(lines.length, Number(line) || 1));
  const start = Math.max(1, center - Math.min(MAX_WINDOW, radius));
  const end = Math.min(lines.length, center + Math.min(MAX_WINDOW, radius));
  return {
    start,
    end,
    lineCount: lines.length,
    snippet: lines.slice(start - 1, end).map((value, index) => String(start + index).padStart(5, " ") + " | " + value).join("\n")
  };
}

export function validateSurgicalPatch(candidate, frame, snippet, fullSource) {
  if (!candidate || candidate.can_fix_strictly !== true) throw new Error("The model declined a strictly scoped fix.");
  if (!Number.isInteger(candidate.confidence) || candidate.confidence < 8 || candidate.confidence > 10) throw new Error("Fix confidence must be 8–10.");
  const target = normalizePath(candidate.target_file);
  if (target !== frame.file || isProtectedPath(target)) throw new Error("The proposed target is not the exact whitelisted stack-trace file.");
  if (typeof candidate.scope_justification !== "string" || candidate.scope_justification.trim().length < 12) throw new Error("Missing scope justification.");
  if (typeof candidate.reason !== "string" || candidate.reason.trim().length < 8) throw new Error("Missing root-cause explanation.");
  const search = candidate.search_code;
  const replace = candidate.replace_code;
  if (typeof search !== "string" || !search.trim() || typeof replace !== "string" || !replace.trim()) throw new Error("Search and replacement blocks must be non-empty strings.");
  if (/^\s*import\s/m.test(search) || /^\s*import\s/m.test(replace) || /^\s*(?:export\s+)?(?:const|let|var)\s+.*(?:from\s*['"])/m.test(replace)) throw new Error("Import or dependency changes are forbidden.");
  const snippetLines = snippet.split(/\r?\n/).map(x => x.replace(/^\s*\d+\s\| /, ""));
  const plainSnippet = snippetLines.join("\n");
  if (!plainSnippet.includes(search)) throw new Error("Search block is not verbatim within the ±40-line scoped excerpt.");
  const occurrences = fullSource.split(search).length - 1;
  if (occurrences !== 1) throw new Error("Search block must occur exactly once in the full source file.");
  const oldLines = search.split(/\r?\n/).length;
  const newLines = replace.split(/\r?\n/).length;
  const changedLines = oldLines + newLines;
  if (Math.abs(newLines - oldLines) > MAX_CHANGED_LINES || changedLines > MAX_CHANGED_LINES) throw new Error("Patch exceeds the 15-line hard cap.");
  const next = fullSource.replace(search, replace);
  if (next === fullSource) throw new Error("Patch produced no change.");
  return { target, search, replace, next, oldLines, newLines, changedLines, reason: candidate.reason.trim(), scopeJustification: candidate.scope_justification.trim() };
}

function b64decode(value) {
  const binary = atob(String(value || "").replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
function b64encode(value) {
  const bytes = enc.encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
async function sha256(value) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(value)));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}
function safe(value, max = 600) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}
async function githubRequest(token, path, init = {}) {
  const response = await fetch("https://api.github.com" + path, {
    ...init,
    headers: {
      accept: "application/vnd.github+json",
      authorization: "Bearer " + token,
      "x-github-api-version": "2022-11-28",
      "user-agent": "LeadMASTER-Auto-Heal/1.0",
      ...(init.headers || {})
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("GitHub API HTTP " + response.status + ": " + safe(body.message || response.statusText, 240));
  return body;
}

export async function verifyActionsOidc(token, fetcher = fetch) {
  if (typeof token !== "string" || token.split(".").length !== 3) return false;
  try {
    const [headerPart, payloadPart, signaturePart] = token.split(".");
    const decode = value => JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4)), c => c.charCodeAt(0))));
    const header = decode(headerPart), claims = decode(payloadPart);
    const audienceValid = claims.aud === "leadmaster-auto-heal" || (Array.isArray(claims.aud) && claims.aud.includes("leadmaster-auto-heal"));
    if (header.alg !== "RS256" || claims.iss !== "https://token.actions.githubusercontent.com" ||
        !audienceValid || claims.repository !== "DevJel/LeadMASTER" ||
        !["incident-trigger.yml", "auto-heal-guard.yml"].some(name => String(claims.workflow_ref || "").startsWith("DevJel/LeadMASTER/.github/workflows/" + name + "@refs/"))) return false;
    const keysResponse = await fetcher("https://token.actions.githubusercontent.com/.well-known/jwks");
    if (!keysResponse.ok) return false;
    const keys = await keysResponse.json();
    const jwk = (keys.keys || []).find(key => key.kid === header.kid && key.kty === "RSA");
    if (!jwk) return false;
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const signature = Uint8Array.from(atob(signaturePart.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - signaturePart.length % 4) % 4)), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, enc.encode(headerPart + "." + payloadPart));
    const now = Math.floor(Date.now() / 1000);
    return valid && Number(claims.exp) > now && Number(claims.iat) <= now + 60 && Number(claims.nbf || 0) <= now + 60;
  } catch { return false; }
}

async function createManualIssue(token, repo, title, body, sourceIssue) {
  if (sourceIssue) return { url: sourceIssue, created: false };
  const issue = await githubRequest(token, "/repos/" + repo + "/issues", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ title, body, labels: [] })
  });
  return { url: issue.html_url, created: true };
}

async function analyzeAndPropose(env, frame, stacktrace, sourceIssue) {
  const token = String(env.GITHUB_TOKEN || "");
  if (!token) throw new Error("The Worker GITHUB_TOKEN secret is not configured; safe source inspection and PR creation require a least-privilege GitHub token.");
  const repo = String(env.REPORTER_GITHUB_REPOSITORY || "DevJel/LeadMASTER");
  const branch = await githubRequest(token, "/repos/" + repo + "/branches/main");
  const sha = branch.commit?.sha;
  if (!sha) throw new Error("Could not resolve main branch head.");
  const file = await githubRequest(token, "/repos/" + repo + "/contents/" + frame.file + "?ref=" + encodeURIComponent(sha));
  if (file.encoding !== "base64" || typeof file.content !== "string") throw new Error("GitHub did not return a text source file.");
  const source = b64decode(file.content);
  const scoped = extractScopedWindow(source, frame.line);
  if (!scoped.snippet) throw new Error("The failing line is outside the available source file.");
  if (!env.AI || typeof env.AI.run !== "function") throw new Error("Workers AI binding is not available.");
  const aiResult = await env.AI.run(MODEL, {
    messages: [
      { role: "system", content: STRICT_FIX_PROMPT },
      { role: "user", content: JSON.stringify({ stacktrace: safe(stacktrace, 8000), target_file: frame.file, failing_line: frame.line, excerpt_start_line: scoped.start, excerpt_end_line: scoped.end, excerpt: scoped.snippet }) }
    ],
    response_format: { type: "json_object" }
  });
  let candidate;
  try {
    const raw = typeof aiResult === "string" ? aiResult : aiResult?.response;
    candidate = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch { throw new Error("Workers AI did not return valid JSON."); }
  const patch = validateSurgicalPatch(candidate, frame, scoped.snippet, source);
  const preflightFiles = [patch.target];
  if (preflightFiles.length !== 1 || patch.changedLines > MAX_CHANGED_LINES || patch.changedLines > MAX_DIFF_LINES || isProtectedPath(patch.target)) {
    throw new Error("Pre-branch gatekeeper rejected the candidate before any Git branch was created.");
  }
  const errorHash = await sha256(frame.file + ":" + frame.line + ":" + safe(stacktrace, 8000));
  const branchName = "fix/auto-heal-" + errorHash;
  const ref = await githubRequest(token, "/repos/" + repo + "/git/ref/heads/main");
  await githubRequest(token, "/repos/" + repo + "/git/refs", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ ref: "refs/heads/" + branchName, sha: ref.object.sha })
  });
  await githubRequest(token, "/repos/" + repo + "/contents/" + frame.file, {
    method: "PUT", headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: "fix(auto-heal): " + safe(candidate.reason, 100), content: b64encode(patch.next), branch: branchName, sha: file.sha })
  });
  const comparison = await githubRequest(token, "/repos/" + repo + "/compare/main..." + branchName);
  const changedFiles = Array.isArray(comparison.files) ? comparison.files : [];
  const diffLines = Number(comparison.ahead_by >= 0 ? changedFiles.reduce((sum, item) => sum + Number(item.additions || 0) + Number(item.deletions || 0), 0) : Infinity);
  const forbidden = changedFiles.some(item => isProtectedPath(item.filename));
  if (changedFiles.length > 2 || diffLines > MAX_DIFF_LINES || forbidden || changedFiles.length !== 1 || changedFiles[0]?.filename !== frame.file) {
    throw new Error("Pre-PR gatekeeper rejected the branch: file whitelist or diff-size limit exceeded.");
  }
  const pr = await githubRequest(token, "/repos/" + repo + "/pulls", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: "Auto-heal: " + safe(candidate.reason, 100),
      head: branchName, base: "main", draft: true,
      body: "## Automated surgical fix — review required\n\n" +
        "- Error hash: `" + errorHash + "`\n" +
        "- Stack-trace target: `" + frame.file + ":" + frame.line + "`\n" +
        "- Scoped source excerpt: lines " + scoped.start + "–" + scoped.end + " (±40 lines)\n" +
        "- Changed lines: " + patch.changedLines + " (hard cap 15)\n" +
        "- Diff total: " + diffLines + " (hard cap 20)\n" +
        "- Reason: " + safe(candidate.reason, 400) + "\n" +
        "- Scope: " + safe(candidate.scope_justification, 400) + "\n\n" +
        "This PR is draft-only. It cannot deploy or merge itself. The Auto-Heal Guard must pass before a human review."
    })
  });
  return { status: "pr_opened", errorHash, branch: branchName, prUrl: pr.html_url, confidence: candidate.confidence, changedLines: patch.changedLines, diffLines, target: frame.file };
}

export async function recordRejectedFix(env, errorHash, detail) {
  if (!env.AUTO_HEAL_KV || typeof env.AUTO_HEAL_KV.put !== "function") throw new Error("AUTO_HEAL_KV binding is not configured.");
  await env.AUTO_HEAL_KV.put("rejected:" + String(errorHash).slice(0, 64), JSON.stringify({ status: "rejected", detail: safe(detail, 1000), at: new Date().toISOString() }), { expirationTtl: 60 * 60 * 24 * 90 });
  return true;
}

export async function processAutoHealEvent(env, event) {
  const repo = String(env.REPORTER_GITHUB_REPOSITORY || "DevJel/LeadMASTER");
  const stacktrace = safe(event.stacktrace || event.issue_body || "", 8000);
  const frames = parseStackFrames(stacktrace);
  const token = String(env.GITHUB_TOKEN || "");
  const computedHash = await sha256((frames[0]?.file || "unknown") + ":" + (frames[0]?.line || 0) + ":" + (stacktrace || safe(event.event_id || event.issue_url || event.event_type, 1000)));
  const errorHash = event.event_type === "rejected" ? String(event.error_hash || computedHash) : computedHash;
  const kv = env.AUTO_HEAL_KV;
  if (event.event_type !== "rejected" && kv?.get) {
    const rejected = await kv.get("rejected:" + errorHash);
    if (rejected) return { status: "already_processed", errorHash, prior: JSON.parse(rejected) };
    const prior = await kv.get("error:" + errorHash);
    if (prior) return { status: "already_processed", errorHash, prior: JSON.parse(prior) };
  }
  let result;
  let sourceIssue = typeof event.issue_url === "string" ? event.issue_url : "";
  try {
    if (event.event_type === "rejected") {
      const rejectedHash = String(event.error_hash || errorHash);
      await recordRejectedFix(env, rejectedHash, event.detail || "Auto-heal CI rejected the proposed patch.");
      result = { status: "rejected", errorHash: rejectedHash, reason: safe(event.detail || "The strict auto-heal CI gate rejected this patch.") };
    } else if (!frames.length) {
      result = { status: "manual_action", errorHash, reason: "No exact application stack-trace file and line could be extracted; no source changes were attempted.", issueUrl: sourceIssue || "" };
    } else {
      result = await analyzeAndPropose(env, frames[0], stacktrace, sourceIssue);
    }
  } catch (error) {
    result = { status: "manual_action", errorHash, reason: safe(error?.message || error, 1000), target: frames[0] ? frames[0].file + ":" + frames[0].line : "" };
  }
  if (result.status === "manual_action" && token && !sourceIssue) {
    try {
      const issue = await createManualIssue(token, repo,
        "[Auto-heal manual review] " + safe(event.title || event.event_type || "Production failure", 100),
        "## Automated investigation requires manual action\n\n" +
        "- Error hash: `" + errorHash + "`\n" +
        "- Target: `" + safe(result.target || "No exact source line", 200) + "`\n" +
        "- Reason: " + safe(result.reason, 1000) + "\n\n" +
        "The automated worker did not modify source because the strict scope, access or patch checks could not be satisfied.\n",
        "");
      result.issueUrl = issue.url;
    } catch (issueError) {
      result.issueCreationError = safe(issueError?.message || issueError, 300);
    }
  }
  if (kv?.put) await kv.put("error:" + errorHash, JSON.stringify({ ...result, at: new Date().toISOString() }), { expirationTtl: 60 * 60 * 24 * 30 });
  return result;
}
