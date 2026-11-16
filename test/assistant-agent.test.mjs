import { test } from "node:test";
import assert from "node:assert/strict";
import { assistantAgentRoute } from "../src/assistant-agent.mjs";

const session = { email: "admin@example.test", accountId: "acct_" + "A".repeat(22) };
const adminEmail = "admin@example.test";
function envFor(ai) {
  return {
    AI: { run: ai },
    AUTH_DB: {
      prepare(sql) {
        const statement = {
          args: [],
          bind(...args) { this.args = args; return this; },
          async first() {
            if (sql.includes("INSERT INTO auth_rate_limits")) return { count: 1 };
            if (sql.includes("COUNT(*) AS total")) return { total: 2 };
            return null;
          },
          async all() {
            if (sql.includes("FROM inbound_mail")) return { results: [{ id: "11111111-1111-4111-8111-111111111111", from_address: "lead@example.test", subject: "Pricing request", received_at: 100 }] };
            return { results: [] };
          }
        };
        return statement;
      }
    },
    INBOUND_MAIL: { get: async () => null }
  };
}
function request(messages, origin = "https://example.test") {
  return new Request("https://example.test/api/admin/assistant", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({ messages })
  });
}

test("assistant requires the configured administrator and same-origin POST", async () => {
  const env = envFor(async () => ({ response: "ok" }));
  assert.equal((await assistantAgentRoute(request([{ role: "user", content: "Hello" }]), env, null, adminEmail)).status, 401);
  assert.equal((await assistantAgentRoute(request([{ role: "user", content: "Hello" }]), env, { ...session, email: "other@example.test" }, adminEmail)).status, 403);
  assert.equal((await assistantAgentRoute(request([{ role: "user", content: "Hello" }], "https://evil.test"), env, session, adminEmail)).status, 403);
});

test("assistant uses a bounded tool loop and returns only mailbox facts supplied by tools", async () => {
  let calls = 0;
  const env = envFor(async (_model, input) => {
    calls++;
    if (calls === 1) {
      assert.ok(Array.isArray(input.tools));
      return { tool_calls: [{ name: "get_inbox_overview", arguments: {} }] };
    }
    return { response: "There are 2 active inbox messages. The latest is a pricing request from lead@example.test." };
  });
  const response = await assistantAgentRoute(request([{ role: "user", content: "Summarize my inbox." }]), env, session, adminEmail);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.match(result.reply, /2 active inbox messages/);
  assert.deepEqual(result.actions, [{ name: "get_inbox_overview", status: "completed" }]);
  assert.equal(result.prepared_email, null);
  assert.equal(calls, 2);
});

test("assistant prepares an unsent email only when the user supplied the exact recipient", async () => {
  let calls = 0;
  const env = envFor(async () => {
    calls++;
    if (calls === 1) return { tool_calls: [{ name: "prepare_email", arguments: { to: "lead@example.test", subject: "Following up", text: "Thank you for your enquiry." } }] };
    return { response: "The draft is ready for your review in Compose." };
  });
  const response = await assistantAgentRoute(request([{ role: "user", content: "Prepare a follow-up to lead@example.test." }]), env, session, adminEmail);
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(result.prepared_email, { to: "lead@example.test", subject: "Following up", text: "Thank you for your enquiry." });
  assert.deepEqual(result.actions, [{ name: "prepare_email", status: "needs_review" }]);
});

test("assistant refuses to invent an email recipient and never sends mail", async () => {
  let calls = 0;
  const env = envFor(async () => {
    calls++;
    if (calls === 1) return { tool_calls: [{ name: "prepare_email", arguments: { to: "invented@example.test", subject: "Hello", text: "Message" } }] };
    return { response: "I need the recipient address from you before preparing the draft." };
  });
  const response = await assistantAgentRoute(request([{ role: "user", content: "Prepare a message to the lead." }]), env, session, adminEmail);
  const result = await response.json();
  assert.equal(result.prepared_email, null);
  assert.deepEqual(result.actions, [{ name: "prepare_email", status: "needs_attention" }]);
});
