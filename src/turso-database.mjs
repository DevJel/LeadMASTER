import { createClient } from "@libsql/client/web";

const databaseCache = new WeakMap();

function normalizeValue(value) {
  if (value === undefined) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  return value;
}

function toPlainRow(result, row) {
  const output = {};
  for (let index = 0; index < result.columns.length; index += 1) {
    const column = result.columns[index];
    output[column] = row[column] ?? row[index] ?? null;
  }
  return output;
}

function toD1Meta(result) {
  const rowId = result.lastInsertRowid;
  return {
    changes: Number(result.rowsAffected || 0),
    last_row_id: rowId == null ? 0 : Number(rowId),
    duration: 0
  };
}

class TursoStatement {
  constructor(client, sql, args = []) {
    this.client = client;
    this.sql = sql;
    this.args = args.map(normalizeValue);
  }

  bind(...args) {
    return new TursoStatement(this.client, this.sql, args);
  }

  async first(columnName) {
    const result = await this.client.execute({ sql: this.sql, args: this.args });
    if (!result.rows.length) return null;
    const row = toPlainRow(result, result.rows[0]);
    return typeof columnName === "string" ? row[columnName] ?? null : row;
  }

  async all() {
    const result = await this.client.execute({ sql: this.sql, args: this.args });
    return {
      results: result.rows.map(row => toPlainRow(result, row)),
      success: true,
      meta: toD1Meta(result)
    };
  }

  async run() {
    const result = await this.client.execute({ sql: this.sql, args: this.args });
    return { success: true, meta: toD1Meta(result) };
  }
}

function createD1CompatibleFacade(client) {
  return Object.freeze({
    prepare(sql) {
      if (typeof sql !== "string" || !sql.trim()) throw new TypeError("SQL statement is required");
      return new TursoStatement(client, sql);
    },
    async batch(statements) {
      if (!Array.isArray(statements) || statements.some(statement => !(statement instanceof TursoStatement))) {
        throw new TypeError("batch() requires statements prepared by this Turso database adapter");
      }
      const results = await client.batch(
        statements.map(statement => ({ sql: statement.sql, args: statement.args })),
        "write"
      );
      return results.map(result => ({
        results: result.rows.map(row => toPlainRow(result, row)),
        success: true,
        meta: toD1Meta(result)
      }));
    },
    async exec(sql) {
      const result = await client.executeMultiple(sql);
      return { count: result.length, duration: 0 };
    }
  });
}

/**
 * Creates one libSQL client per Worker environment object. The adapter preserves
 * the small D1 statement surface used by existing LeadMASTER modules while all
 * SQL is executed remotely by Turso. No D1 binding is required.
 */
export async function bindTursoDatabase(env) {
  if (!env || typeof env !== "object") throw new TypeError("Worker environment is required");
  const cached = databaseCache.get(env);
  if (cached) return cached;

  const url = typeof env.TURSO_URL === "string" ? env.TURSO_URL.trim() : "";
  const tokenBinding = env.TURSO_AUTH_TOKEN;
  const authToken = typeof tokenBinding?.get === "function"
    ? await tokenBinding.get()
    : tokenBinding;
  if (!url.startsWith("libsql://")) throw new Error("TURSO_URL is missing or invalid");
  if (typeof authToken !== "string" || !authToken.trim()) throw new Error("TURSO_AUTH_TOKEN is missing");

  const client = createClient({ url, authToken: authToken.trim() });
  const database = createD1CompatibleFacade(client);
  databaseCache.set(env, database);
  return database;
}

/** Provide the legacy database property as a compatibility facade, not a D1 binding. */
export async function withTursoDatabase(env) {
  // Preserve explicit test/local database injection; deployed Wrangler configs
  // no longer provide AUTH_DB, so production always resolves to Turso.
  if (env && env.AUTH_DB) return env;
  const database = await bindTursoDatabase(env);
  return new Proxy(env, {
    get(target, property, receiver) {
      if (property === "AUTH_DB") return database;
      return Reflect.get(target, property, receiver);
    }
  });
}
