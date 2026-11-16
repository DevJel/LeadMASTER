import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { routeHttp } from "../src/http-router.mjs";

const apiKey = "lm_live_" + "a".repeat(43);
const keyHash = createHash("sha256").update(apiKey).digest("hex");
function envFor(scopes = []) {
  const row = { id: "key-1", key_hash: keyHash, scopes: JSON.stringify(scopes), revoked_at: null, account_id: "acct_" + "A".repeat(22) };
  const AUTH_DB = {
    prepare(sql) {
      const statement = {
        args: [],
        bind(...args) { this.args = args; return this; },
        async first() {
          if (sql.includes("FROM developer_api_keys")) return row;
          if (sql.includes("INSERT INTO auth_rate_limits")) return { count: 1 };
          return null;
        }
      };
      return statement;
    }
  };
  return { AUTH_DB, MCP_ALLOWED_ORIGIN: "https://client.example" };
}
const headers = {
  authorization: "Bearer " + apiKey,
  "content-type": "application/json",
  accept: "application/json, text/event-stream",
  "mcp-protocol-version": "2025-11-25"
};
const rpc = (method, params = {}, id = 1) => ({ jsonrpc: "2.0", id, method, params });
const call = (body, requestHeaders = headers, env = envFor()) => routeHttp(
  new Request("https://example.test/mcp", { method: "POST", headers: requestHeaders, body: JSON.stringify(body) }),
  env
);

test("MCP requires a valid account-bound LeadMASTER API key", async () => {
  assert.equal((await call(rpc("tools/list"), { ...headers, authorization: "Bearer invalid" })).status, 401);
  assert.equal((await call(rpc("tools/list"), headers, {})).status, 401);
});

test("MCP exposes only the tools permitted by the authenticated key scopes", async () => {
  const basic = await call(rpc("tools/list"), headers, envFor([]));
  assert.equal(basic.status, 200);
  const basicNames = (await basic.json()).result.tools.map(tool => tool.name).sort();
  assert.deepEqual(basicNames, ["get_email_capabilities", "validate_email"]);

  const scoped = await call(rpc("tools/list"), headers, envFor(["email:send", "email:read", "webhook:manage"]));
  assert.equal(scoped.status, 200);
  const names = (await scoped.json()).result.tools.map(tool => tool.name).sort();
  assert.deepEqual(names, [
    "create_webhook", "get_email_capabilities", "get_email_status", "list_webhook_deliveries",
    "list_webhooks", "revoke_webhook", "send_email", "validate_email"
  ]);
});

test("MCP initializes and validates email payloads without sending or echoing content", async () => {
  const init = await call(rpc("initialize", { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "test", version: "1" } }));
  assert.equal(init.status, 200);
  assert.equal((await init.json()).result.serverInfo.name, "leadmaster");
  const response = await call(rpc("tools/call", { name: "validate_email", arguments: { to: "person@example.org", subject: "Hello", text: "Private message" } }));
  const value = await response.json();
  const parsed = JSON.parse(value.result.content[0].text);
  assert.equal(parsed.valid, true);
  assert.equal(parsed.sent, false);
  assert.ok(!JSON.stringify(value).includes("Private message"));
  const bad = await call(rpc("tools/call", { name: "validate_email", arguments: { to: "bad", subject: "a", text: "b" } }));
  assert.equal(JSON.parse((await bad.json()).result.content[0].text).valid, false);
});

test("MCP enforces exact Origin allowlist when an Origin header is present", async () => {
  const origin = { ...headers, origin: "https://client.example" };
  assert.equal((await call(rpc("tools/list"), origin, envFor())).status, 200);
  assert.equal((await call(rpc("tools/list"), { ...origin, origin: "https://client.example.evil.test" }, envFor()).status, 403);
});

test("MCP bounds request size and rejects unsupported methods", async () => {
  const oversized = await call(rpc("tools/call", { name: "validate_email", arguments: { to: "a@example.org", subject: "a", text: "a".repeat(100001) } }));
  assert.equal(oversized.status, 413);
  const get = await routeHttp(new Request("https://example.test/mcp", { method: "GET", headers }), envFor());
  assert.equal(get.status, 405);
});
