import { readBoundedJson } from "./bounded-json.mjs";

const COLLECTIONS = new Set([
  "leadmaster_prefs", "leadmaster_messages", "leadmaster_templates",
  "leadmaster_rules", "leadmaster_scheduled", "leadmaster_contacts",
  "leadmaster_reminders", "leadmaster_notes"
]);
const json = (body, status = 200) => Response.json(body, {
  status,
  headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" }
});
const enc = new TextEncoder();
const validId = value => typeof value === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(value);
const validCollection = value => typeof value === "string" && COLLECTIONS.has(value);
const validValue = value => value && typeof value === "object" && !Array.isArray(value) &&
  enc.encode(JSON.stringify(value)).length <= 256_000;

export async function leadmasterRecordsRoute(request, env, session) {
  if (!session?.email || !session?.accountId) return json({ error: "Unauthorized" }, 401);
  if (!env?.AUTH_DB) return json({ error: "Workspace storage is unavailable" }, 503);
  const url = new URL(request.url);
  if (url.pathname !== "/api/workspace/actions") return json({ error: "Not found" }, 404);
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (request.headers.get("Origin") !== url.origin) return json({ error: "Invalid request origin" }, 403);

  let body;
  try { body = await readBoundedJson(request, 300_000); }
  catch { return json({ error: "Invalid request body" }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      typeof body.action !== "string" || !body.args || typeof body.args !== "object" || Array.isArray(body.args)) {
    return json({ error: "Invalid action" }, 400);
  }

  const { action, args } = body;
  const collection = args.collection;
  if (!validCollection(collection)) return json({ error: "Unknown workspace collection" }, 400);
  const db = env.AUTH_DB;
  const accountId = session.accountId;

  try {
    if (action === "records.list") {
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
      const result = await db.prepare(
        "SELECT id, value_json, created_at, updated_at FROM leadmaster_records WHERE account_id = ? AND collection = ? ORDER BY updated_at DESC LIMIT 500"
      ).bind(accountId, collection).all();
      const records = (result.results || []).map(row => {
        let value = {};
        try { value = JSON.parse(row.value_json); } catch {}
        return { id: row.id, value, created_at: row.created_at, updated_at: row.updated_at };
      });
      return json({ data: { records } });
    }

    if (action === "records.create") {
      if (!validValue(args.value)) return json({ error: "Invalid record value" }, 400);
      const key = typeof args.idempotency_key === "string" ? args.idempotency_key.trim() : "";
      if (!key || key.length > 200) return json({ error: "A valid idempotency key is required" }, 400);
      const now = Date.now();
      const id = crypto.randomUUID();
      await db.prepare(
        "INSERT OR IGNORE INTO leadmaster_records (id, account_id, collection, value_json, idempotency_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).bind(id, accountId, collection, JSON.stringify(args.value), key, now, now).run();
      const saved = await db.prepare(
        "SELECT id FROM leadmaster_records WHERE account_id = ? AND collection = ? AND idempotency_key = ?"
      ).bind(accountId, collection, key).first();
      if (!saved?.id) return json({ error: "Record could not be saved" }, 503);
      return json({ data: { id: saved.id } }, 201);
    }

    if (action === "records.replace") {
      if (!validId(args.id) || !validValue(args.value)) return json({ error: "Invalid record update" }, 400);
      const result = await db.prepare(
        "UPDATE leadmaster_records SET value_json = ?, updated_at = ? WHERE id = ? AND account_id = ? AND collection = ?"
      ).bind(JSON.stringify(args.value), Date.now(), args.id, accountId, collection).run();
      if ((result?.meta?.changes || 0) !== 1) return json({ error: "Record not found" }, 404);
      return json({ data: { id: args.id } });
    }

    if (action === "records.delete") {
      if (!validId(args.id)) return json({ error: "Invalid record ID" }, 400);
      const result = await db.prepare(
        "DELETE FROM leadmaster_records WHERE id = ? AND account_id = ? AND collection = ?"
      ).bind(args.id, accountId, collection).run();
      if ((result?.meta?.changes || 0) !== 1) return json({ error: "Record not found" }, 404);
      return json({ data: { deleted: true } });
    }
    return json({ error: "Unsupported workspace action" }, 400);
  } catch (error) {
    console.error("LeadMASTER workspace record operation failed", String(error?.message || error).slice(0, 240));
    return json({ error: "Workspace data is temporarily unavailable" }, 503);
  }
}
