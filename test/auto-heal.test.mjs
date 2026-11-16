import test from "node:test";
import assert from "node:assert/strict";
import {
  extractScopedWindow,
  isProtectedPath,
  parseStackFrames,
  validateSurgicalPatch,
  verifyActionsOidc,
  processAutoHealEvent
} from "../src/auto-heal.mjs";

test("stack parser extracts only exact application source file and line", () => {
  const frames = parseStackFrames([
    "TypeError: Cannot read properties of undefined",
    "    at renderCard (/home/runner/work/LeadMASTER/LeadMASTER/src/components/cards.tsx:88:14)",
    "    at Object.run (node:internal/modules/cjs/loader:10:2)",
    "    at test (/home/runner/work/LeadMASTER/LeadMASTER/src/cards.test.ts:9:1)"
  ].join("\n"));
  assert.equal(frames.length, 1);
  assert.deepEqual({ file: frames[0].file, line: frames[0].line, column: frames[0].column }, {
    file: "src/components/cards.tsx", line: 88, column: 14
  });
});

test("source scoping is capped at exactly plus or minus 40 lines", () => {
  const source = Array.from({ length: 200 }, (_, i) => "line-" + (i + 1)).join("\n");
  const window = extractScopedWindow(source, 100, 500);
  assert.equal(window.start, 60);
  assert.equal(window.end, 140);
  assert.equal(window.snippet.split("\n").length, 81);
  assert.match(window.snippet, /^   60 \| line-60/);
});

test("protected paths reject tests, configuration, auth, migrations and worker entrypoints", () => {
  for (const path of [
    "src/auth/login.ts", "src/config.ts", "src/foo.test.ts", "src/foo.spec.ts",
    "src/ExampleTest.kt", "migrations/0021.sql", "worker.js", "wrangler.jsonc",
    "package.json", ".github/workflows/ci.yml", "src/anything.gradle"
  ]) assert.equal(isProtectedPath(path), true, path);
  assert.equal(isProtectedPath("src/utils/safe-helper.mjs"), false);
});

test("strict patch accepts only exact one-occurrence search and replacement within scoped excerpt", () => {
  const frame = { file: "src/utils/safe-helper.mjs", line: 12 };
  const source = "function safe(value) {\n  return value.trim();\n}\n";
  const scoped = extractScopedWindow(source, 2);
  const patch = validateSurgicalPatch({
    can_fix_strictly: true,
    confidence: 9,
    target_file: frame.file,
    search_code: "  return value.trim();",
    replace_code: "  return String(value ?? \"\").trim();",
    scope_justification: "The failing call is guarded at the exact dereference.",
    reason: "The value may be null before trim is invoked."
  }, frame, scoped.snippet, source);
  assert.equal(patch.changedLines, 2);
  assert.match(patch.next, /String\(value/);
});

test("strict patch rejects unrelated file, duplicate block, imports and over-15-line changes", () => {
  const frame = { file: "src/utils/safe-helper.mjs", line: 1 };
  const source = "return value;\n";
  const snippet = extractScopedWindow(source, 1).snippet;
  const base = {
    can_fix_strictly: true, confidence: 10, target_file: frame.file,
    search_code: "return value;", replace_code: "return value ?? null;",
    scope_justification: "The return is guarded at the failure point.",
    reason: "The value can be undefined."
  };
  assert.throws(() => validateSurgicalPatch({ ...base, target_file: "src/auth/login.ts" }, frame, snippet, source), /target/);
  assert.throws(() => validateSurgicalPatch({ ...base, replace_code: "import x from 'x';" }, frame, snippet, source), /Import/);
  assert.throws(() => validateSurgicalPatch({ ...base, replace_code: Array(16).fill("x").join("\n") }, frame, snippet, source), /15-line/);
  assert.throws(() => validateSurgicalPatch({ ...base, search_code: "return other;" }, frame, snippet, source), /verbatim/);
});

test("OIDC verification fails closed for missing, malformed or wrong-audience tokens", async () => {
  assert.equal(await verifyActionsOidc(""), false);
  assert.equal(await verifyActionsOidc("not.a.jwt"), false);
  const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  const fake = encode({ alg: "RS256", kid: "missing" }) + "." +
    encode({ iss: "https://token.actions.githubusercontent.com", aud: "wrong", repository: "DevJel/LeadMASTER", workflow_ref: "DevJel/LeadMASTER/.github/workflows/incident-trigger.yml@refs/heads/main", exp: 9999999999, iat: 1, nbf: 1 }) +
    ".c2ln";
  assert.equal(await verifyActionsOidc(fake, async () => ({ ok: false })), false);
});


test("incident payload credentials cannot authorize GitHub calls", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error("unexpected outbound request"); };
  try {
    const result = await processAutoHealEvent({}, {
      event_type: "workflow_failure", event_id: "untrusted",
      stacktrace: "Error: failure\n    at fn (/home/runner/work/LeadMASTER/LeadMASTER/src/safe-helper.mjs:12:3)",
      github_token: "untrusted-event-token"
    });
    assert.equal(result.status, "manual_action");
    assert.match(result.reason, /Worker GITHUB_TOKEN secret is not configured/);
    assert.equal(calls, 0);
    assert.doesNotMatch(JSON.stringify(result), /untrusted-event-token/);
  } finally { globalThis.fetch = original; }
});

test("incident workflows never forward GitHub Actions tokens", async () => {
  const { readFile } = await import("node:fs/promises");
  const incident = await readFile(new URL("../.github/workflows/incident-trigger.yml", import.meta.url), "utf8");
  const guard = await readFile(new URL("../.github/workflows/auto-heal-guard.yml", import.meta.url), "utf8");
  const incidentSendStep = incident.split("- name: Send verified incident to LeadMASTER Worker")[1];
  const guardSendStep = guard.split("- name: Record the rejected hash")[1];
  assert.ok(incidentSendStep && guardSendStep);
  assert.doesNotMatch(incidentSendStep, /github_token|GH_TOKEN/i);
  assert.doesNotMatch(guardSendStep, /github_token|GH_TOKEN/i);
  assert.match(guard, /npm ci\s+npm run build:assets\s+npm test/);
});


test("manual issue creation uses only the server-configured credential", async () => {
  const original = globalThis.fetch;
  const authorizations = [];
  globalThis.fetch = async (_url, init) => {
    authorizations.push(init.headers.authorization);
    return Response.json({ html_url: "https://github.com/example/test/issues/1" });
  };
  try {
    const result = await processAutoHealEvent({ GITHUB_TOKEN: "server-fixture-token" }, {
      event_type: "workflow_failure", event_id: "no-frame", title: "Test",
      github_token: "payload-fixture-token"
    });
    assert.equal(result.status, "manual_action");
    assert.deepEqual(authorizations, ["Bearer server-fixture-token"]);
    assert.doesNotMatch(JSON.stringify(result), /fixture-token/);
  } finally { globalThis.fetch = original; }
});


test("auto-heal reads the GitHub token from a Cloudflare Secret Store binding", async () => {
  const original = globalThis.fetch;
  const authorizations = [];
  const secret = "secret-store-fixture-token";
  globalThis.fetch = async (_url, init) => {
    authorizations.push(init.headers.authorization);
    return Response.json({ html_url: "https://github.com/DevJel/LeadMASTER/issues/987" });
  };
  try {
    const result = await processAutoHealEvent({ GITHUB_TOKEN: { get: async () => secret } }, {
      event_type: "workflow_failure", event_id: "no-frame", title: "Secret Store binding test"
    });
    assert.equal(result.status, "manual_action");
    assert.deepEqual(authorizations, ["Bearer " + secret]);
    assert.doesNotMatch(JSON.stringify(result), /secret-store-fixture-token/);
  } finally { globalThis.fetch = original; }
});

test("incident callback queues findings for the daily report and sends no immediate incident email", async () => {
  const { readFile } = await import("node:fs/promises");
  const worker = await readFile(new URL("../worker.js", import.meta.url), "utf8");
  const start = worker.indexOf('if (url.pathname === "/api/auto-heal/trigger")');
  const end = worker.indexOf("const adminSession", start);
  assert.ok(start >= 0 && end > start);
  const route = worker.slice(start, end);
  const afterProcessing = route.slice(route.indexOf("const result = await processAutoHealEvent"));
  assert.match(afterProcessing, /queued_for_daily_report/);
  assert.doesNotMatch(afterProcessing, /runDailyReporter/);
});
