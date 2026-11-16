import test from "node:test";
import assert from "node:assert/strict";
import {
  extractScopedWindow,
  isProtectedPath,
  parseStackFrames,
  validateSurgicalPatch,
  verifyActionsOidc
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
  assert.throws(() => validateSurgicalPatch({ ...base, search_code: "return" }, frame, snippet, source), /verbatim/);
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
