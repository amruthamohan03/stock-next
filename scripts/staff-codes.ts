/**
 * Give every staff a unique code (STFxxxx, derived from the primary key so it
 * is unique by construction). Idempotent:
 *   - installs a BEFORE INSERT/UPDATE trigger that auto-fills a blank code,
 *   - adds a unique index on staff_code,
 *   - backfills existing rows that have no code.
 * Usage: npx tsx scripts/staff-codes.ts
 */
import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const url = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/stock_db";
const sql = postgres(url, { max: 1 });

async function main() {
  // Auto-fill a blank code from the row's id (identity is assigned before
  // BEFORE-INSERT triggers run, so NEW.id is available here).
  await sql`
    CREATE OR REPLACE FUNCTION staff_set_code() RETURNS trigger AS $fn$
    BEGIN
      IF NEW.staff_code IS NULL OR btrim(NEW.staff_code) = '' THEN
        NEW.staff_code := 'STF' || LPAD(NEW.id::text, 4, '0');
      END IF;
      RETURN NEW;
    END;
    $fn$ LANGUAGE plpgsql
  `;
  await sql`DROP TRIGGER IF EXISTS staff_set_code_trg ON staff_t`;
  await sql`
    CREATE TRIGGER staff_set_code_trg
      BEFORE INSERT OR UPDATE ON staff_t
      FOR EACH ROW EXECUTE FUNCTION staff_set_code()
  `;
  console.log("✔ Trigger installed (auto-generates a code when left blank).");

  // Enforce uniqueness at the DB level (ignores NULLs).
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS staff_code_uniq ON staff_t (staff_code) WHERE staff_code IS NOT NULL`;
  console.log("✔ Unique index on staff_code ensured.");

  // Backfill existing rows that have no code.
  const filled = await sql`
    UPDATE staff_t
    SET staff_code = 'STF' || LPAD(id::text, 4, '0')
    WHERE staff_code IS NULL OR btrim(staff_code) = ''
    RETURNING id, staff_code, staff_name`;
  console.log(`✔ Backfilled ${filled.length} staff without a code.`);
  for (const r of filled) console.log(`   #${r.id}  ${r.staff_code}  ${r.staff_name}`);

  // Sanity-check: a new insert gets an auto code (rolled back, no data left).
  await sql.begin(async (tx) => {
    const [t] = await tx`INSERT INTO staff_t (staff_name) VALUES ('__code_test__') RETURNING id, staff_code`;
    console.log(`✔ New-insert test → id ${t.id} got code ${t.staff_code}`);
    await tx`ROLLBACK`;
  }).catch(() => {}); // rollback throws by design; ignore

  const all = await sql`SELECT count(*)::int total, count(staff_code)::int coded FROM staff_t WHERE display='Y'`;
  console.log(`\nActive staff: ${all[0].total}, with a code: ${all[0].coded}`);
  await sql.end();
}

main().catch(async (e) => {
  console.error("✖ Failed:", e.message);
  await sql.end();
  process.exit(1);
});
