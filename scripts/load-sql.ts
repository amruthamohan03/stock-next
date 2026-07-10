/**
 * Loads a plain .sql file into Postgres using the postgres.js client.
 * Usage: tsx scripts/load-sql.ts [pg_seed.sql]
 *
 * This lets you load the converted data without needing the `psql` CLI on PATH.
 */
import { readFileSync, existsSync } from "node:fs";
import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const file = process.argv[2] ?? "./pg_seed.sql";
if (!existsSync(file)) {
  console.error(`✖ SQL file not found: ${file}. Run "npm run db:convert" first.`);
  process.exit(1);
}

const url =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/stock_db";

const sql = postgres(url, { max: 1 });

const contents = readFileSync(file, "utf8");

try {
  await sql.unsafe(contents);
  console.log(`✔ Loaded ${file} into the database.`);
} catch (err) {
  console.error("✖ Failed to load SQL file:", err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
