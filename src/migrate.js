// Exécute, dans l'ordre, les fichiers SQL de migrations/ qui n'ont pas encore été appliqués.
import { readdir, readFile } from "node:fs/promises";
import pg from "pg";

const dir = new URL("../migrations/", import.meta.url);
const client = new pg.Client();
await client.connect();
await client.query(
  "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now())"
);

const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
for (const file of files) {
  const { rowCount } = await client.query("SELECT 1 FROM schema_migrations WHERE name = $1", [file]);
  if (rowCount) continue;
  const sql = await readFile(new URL(file, dir), "utf8");
  await client.query("BEGIN");
  await client.query(sql);
  await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
  await client.query("COMMIT");
  console.log(`migration appliquée : ${file}`);
}
await client.end();
