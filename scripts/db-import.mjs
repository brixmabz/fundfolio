// Loads a .sql dump (from db-export.mjs) into a Turso/libSQL database.
// Usage: node --env-file=.env scripts/db-import.mjs backup.sql [--reset]
//   --reset  drop all existing tables in the target first
// Imports into the DB in VITE_TURSO_DATABASE_URL / VITE_TURSO_AUTH_TOKEN,
// so update .env with the NEW database's values first.
import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";

const file = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (!file) throw new Error("Usage: node --env-file=.env scripts/db-import.mjs <dump.sql>");

const url = process.env.VITE_TURSO_DATABASE_URL;
const authToken = process.env.VITE_TURSO_AUTH_TOKEN;
if (!url) throw new Error("VITE_TURSO_DATABASE_URL is not set");

const reset = process.argv.includes("--reset");
console.log(`Importing ${file} into ${url}${reset ? " (dropping existing tables first)" : ""} ...`);
const db = createClient({ url, authToken });
let sql = readFileSync(file, "utf8");

if (reset) {
  // Drop everything already in the target (e.g. tables the app auto-created),
  // inside the dump's own transaction so a failure rolls it all back.
  const { rows } = await db.execute(
    "SELECT type, name FROM sqlite_master WHERE type IN ('view','trigger','table') AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'libsql_%' AND name NOT LIKE '_litestream_%'"
  );
  const drops = rows
    .map((r) => `DROP ${String(r.type).toUpperCase()} IF EXISTS "${String(r.name).replace(/"/g, '""')}";`)
    .join("\n");
  sql = sql.replace("BEGIN TRANSACTION;\n", `BEGIN TRANSACTION;\n${drops}\n`);
}

await db.executeMultiple(sql);

const { rows } = await db.execute(
  "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'libsql_%'"
);
for (const { name } of rows) {
  const r = await db.execute(`SELECT COUNT(*) AS n FROM "${name}"`);
  console.log(`${name}: ${r.rows[0].n} rows`);
}
console.log("Done.");
