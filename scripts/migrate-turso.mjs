import { createClient } from "@libsql/client";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const url = process.env.TURSO_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url || !url.startsWith("libsql://") || !authToken) {
  throw new Error("Set TURSO_URL and TURSO_AUTH_TOKEN before running Turso migrations.");
}

const client = createClient({ url, authToken });
try {
  await client.execute(`CREATE TABLE IF NOT EXISTS leadmaster_schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at INTEGER NOT NULL
  )`);

  const files = (await readdir(join(root, "migrations")))
    .filter(name => /^\d{4}_[a-z0-9_-]+\.sql$/i.test(name))
    .sort();

  for (const file of files) {
    const existing = await client.execute({
      sql: "SELECT 1 FROM leadmaster_schema_migrations WHERE version = ?",
      args: [file]
    });
    if (existing.rows.length) {
      console.log(`skip ${file}`);
      continue;
    }

    const sql = await readFile(join(root, "migrations", file), "utf8");
    await client.executeMultiple(sql);
    await client.execute({
      sql: "INSERT INTO leadmaster_schema_migrations(version, applied_at) VALUES (?, ?)",
      args: [file, Date.now()]
    });
    console.log(`applied ${file}`);
  }
} finally {
  client.close();
}
