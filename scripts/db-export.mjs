// Dumps the whole Turso/libSQL database (schema + data) to a .sql file.
// Usage: node --env-file=.env scripts/db-export.mjs [output.sql]
import { createClient } from "@libsql/client";
import { writeFileSync } from "node:fs";

const url = process.env.VITE_TURSO_DATABASE_URL;
const authToken = process.env.VITE_TURSO_AUTH_TOKEN;
if (!url) throw new Error("VITE_TURSO_DATABASE_URL is not set");

const out = process.argv[2] ?? `backup-${new Date().toISOString().slice(0, 10)}.sql`;
const db = createClient({ url, authToken, intMode: "bigint" });

function literal(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  if (v instanceof ArrayBuffer || ArrayBuffer.isView(v)) {
    return `X'${Buffer.from(v instanceof ArrayBuffer ? v : v.buffer).toString("hex")}'`;
  }
  return `'${String(v).replace(/'/g, "''")}'`;
}

const quoteId = (name) => `"${name.replace(/"/g, '""')}"`;

const { rows: objects } = await db.execute(`
  SELECT type, name, sql FROM sqlite_master
  WHERE sql IS NOT NULL
    AND name NOT LIKE 'sqlite_%'
    AND name NOT LIKE '_litestream_%'
    AND name NOT LIKE 'libsql_%'
  ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 WHEN 'view' THEN 2 ELSE 3 END, rowid
`);

const lines = ["PRAGMA foreign_keys=OFF;", "BEGIN TRANSACTION;"];
const tables = objects.filter((o) => o.type === "table");

for (const t of tables) {
  lines.push(`${t.sql};`);
  const { rows, columns } = await db.execute(`SELECT * FROM ${quoteId(t.name)}`);
  const cols = columns.map(quoteId).join(", ");
  for (const row of rows) {
    const vals = columns.map((_, i) => literal(row[i])).join(", ");
    lines.push(`INSERT INTO ${quoteId(t.name)} (${cols}) VALUES (${vals});`);
  }
  console.log(`${t.name}: ${rows.length} rows`);
}

for (const o of objects.filter((o) => o.type !== "table")) lines.push(`${o.sql};`);
lines.push("COMMIT;");

writeFileSync(out, lines.join("\n") + "\n", "utf8");
console.log(`\nSaved ${tables.length} tables to ${out}`);
