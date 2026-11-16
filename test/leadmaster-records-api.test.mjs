import test from "node:test";
import assert from "node:assert/strict";
import { leadmasterRecordsRoute } from "../src/leadmaster-records-api.mjs";

class FakeDb {
  rows = [];
  prepare(sql) {
    const db = this;
    return {
      values: [],
      bind(...values) { this.values = values; return this; },
      async all() {
        const [account, collection] = this.values;
        return { results: db.rows.filter(r => r.account_id === account && r.collection === collection).sort((a,b)=>b.updated_at-a.updated_at) };
      },
      async first() {
        const [account, collection, key] = this.values;
        return db.rows.find(r => r.account_id === account && r.collection === collection && r.idempotency_key === key) || null;
      },
      async run() {
        if (sql.startsWith("INSERT OR IGNORE")) {
          const [id, account_id, collection, value_json, idempotency_key, created_at, updated_at] = this.values;
          if (!db.rows.some(r => r.account_id === account_id && r.collection === collection && r.idempotency_key === idempotency_key)) {
            db.rows.push({ id, account_id, collection, value_json, idempotency_key, created_at, updated_at });
          }
          return { meta: { changes: 1 } };
        }
        if (sql.startsWith("UPDATE")) {
          const [value_json, updated_at, id, account_id, collection] = this.values;
          const row = db.rows.find(r => r.id === id && r.account_id === account_id && r.collection === collection);
          if (!row) return { meta: { changes: 0 } };
          row.value_json = value_json; row.updated_at = updated_at;
          return { meta: { changes: 1 } };
        }
        if (sql.startsWith("DELETE")) {
          const [id, account_id, collection] = this.values;
          const index = db.rows.findIndex(r => r.id === id && r.account_id === account_id && r.collection === collection);
          if (index < 0) return { meta: { changes: 0 } };
          db.rows.splice(index, 1);
          return { meta: { changes: 1 } };
        }
        throw new Error("Unexpected SQL: " + sql);
      }
    };
  }
}
const session = accountId => ({ email: accountId + "@example.test", accountId });
const request = (body, requestOrigin = "https://leadmaster.test", headerOrigin = requestOrigin) => new Request(requestOrigin + "/api/workspace/actions", {
  method: "POST", headers: { origin: headerOrigin, "content-type": "application/json" }, body: JSON.stringify(body)
});

test("workspace records are isolated by authenticated account", async () => {
  const AUTH_DB = new FakeDb();
  const env = { AUTH_DB };
  const created = await leadmasterRecordsRoute(request({
    action: "records.create",
    args: { collection: "leadmaster_notes", value: { title: "Private" }, idempotency_key: "note-1" }
  }), env, session("acct_one"));
  assert.equal(created.status, 201);
  const listA = await leadmasterRecordsRoute(request({
    action: "records.list", args: { collection: "leadmaster_notes" }
  }), env, session("acct_one"));
  const listB = await leadmasterRecordsRoute(request({
    action: "records.list", args: { collection: "leadmaster_notes" }
  }), env, session("acct_two"));
  assert.equal((await listA.json()).data.records.length, 1);
  assert.equal((await listB.json()).data.records.length, 0);
});

test("workspace create is idempotent and update/delete cannot cross accounts", async () => {
  const AUTH_DB = new FakeDb();
  const env = { AUTH_DB };
  const body = { action: "records.create", args: {
    collection: "leadmaster_templates", value: { name: "Welcome" }, idempotency_key: "template-1"
  }};
  const first = await leadmasterRecordsRoute(request(body), env, session("acct_one"));
  const second = await leadmasterRecordsRoute(request(body), env, session("acct_one"));
  const id = (await first.json()).data.id;
  assert.equal((await second.json()).data.id, id);
  const crossAccount = await leadmasterRecordsRoute(request({
    action: "records.replace", args: { collection: "leadmaster_templates", id, value: { name: "Changed" } }
  }), env, session("acct_two"));
  assert.equal(crossAccount.status, 404);
  const crossDelete = await leadmasterRecordsRoute(request({
    action: "records.delete", args: { collection: "leadmaster_templates", id }
  }), env, session("acct_two"));
  assert.equal(crossDelete.status, 404);
});

test("workspace route rejects missing sessions, foreign origins and unapproved collections", async () => {
  const env = { AUTH_DB: new FakeDb() };
  const payload = { action: "records.list", args: { collection: "leadmaster_notes" } };
  assert.equal((await leadmasterRecordsRoute(request(payload), env, null)).status, 401);
  assert.equal((await leadmasterRecordsRoute(request(payload, "https://leadmaster.test", "https://attacker.test"), env, session("acct_one"))).status, 403);
  assert.equal((await leadmasterRecordsRoute(request({ action: "records.list", args: { collection: "users" } }), env, session("acct_one"))).status, 400);
});
