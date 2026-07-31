/**
 * Add staff_type + staff_category to designation_master_t and classify the
 * seeded designations. Additive & idempotent.
 * Usage: npx tsx scripts/add-designation-classification.ts
 */
import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const url = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/stock_db";
const sql = postgres(url, { max: 1 });

// name → [staff_type, staff_category]
const CLASSIFY: Record<string, [string, string]> = {
  Principal: ["TEACHING", "FACULTY"],
  "Head of Department": ["TEACHING", "FACULTY"],
  Lecturer: ["TEACHING", "FACULTY"],
  "Senior Lecturer": ["TEACHING", "FACULTY"],
  "Workshop Instructor": ["TEACHING", "FACULTY"],
  "Instructor / Demonstrator": ["TEACHING", "FACULTY"],
  Tradesman: ["NON_TEACHING", "LAB_STAFF"],
  "Lab Assistant": ["NON_TEACHING", "LAB_STAFF"],
  "Office Superintendent": ["NON_TEACHING", "OFFICE_STAFF"],
  Clerk: ["NON_TEACHING", "OFFICE_STAFF"],
  Attender: ["NON_TEACHING", "OTHER"],
};

async function main() {
  await sql`ALTER TABLE designation_master_t ADD COLUMN IF NOT EXISTS staff_type varchar(20) DEFAULT 'TEACHING'`;
  await sql`ALTER TABLE designation_master_t ADD COLUMN IF NOT EXISTS staff_category varchar(20) DEFAULT 'FACULTY'`;
  console.log("✔ designation_master_t classification columns are ready.");

  let updated = 0;
  for (const [name, [type, cat]] of Object.entries(CLASSIFY)) {
    const r = await sql`
      UPDATE designation_master_t
      SET staff_type = ${type}, staff_category = ${cat}
      WHERE designation_name = ${name}
      RETURNING id`;
    updated += r.length;
  }
  console.log(`✔ Classified ${updated} seeded designation(s).`);
  await sql.end();
}

main().catch(async (e) => {
  console.error("✖ Failed:", e.message);
  await sql.end();
  process.exit(1);
});
