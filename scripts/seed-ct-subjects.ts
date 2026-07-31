/**
 * Add the extended subject columns and insert the Computer Engineering (CT)
 * curriculum subjects transcribed from the scheme tables. Additive & idempotent
 * (skips a subject if the same code+scheme already exists).
 * Usage: npx tsx scripts/seed-ct-subjects.ts
 */
import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const url = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/stock_db";
const sql = postgres(url, { max: 1 });

const DEPT = 1; // Computer Engineering
// [code, name, category, semester, scheme, type, L, T, P, credits]
type Row = [string, string, string, string, string, "THEORY" | "PRACTICAL", number, number, number, number];

const R21 = "Revision 2021";
const R26 = "Revision 2026";

const SUBJECTS: Row[] = [
  // ── Third Semester · Revision 2021 ──────────────────────────────
  ["3009", "Internship I", "Common Courses", "S3", R21, "PRACTICAL", 0, 0, 0, 2],
  ["3131", "Computer Organisation", "Programme core course", "S3", R21, "THEORY", 4, 0, 0, 4],
  ["3132", "Programming in C", "Programme core course", "S3", R21, "THEORY", 3, 0, 0, 3],
  ["3133", "Database Management Systems", "Programme core course", "S3", R21, "THEORY", 3, 0, 0, 3],
  ["3134", "Digital Computer Fundamentals", "Programme core course", "S3", R21, "THEORY", 3, 0, 0, 3],
  ["3135", "Programming in C Lab", "Programme core course", "S3", R21, "PRACTICAL", 0, 0, 3, 1.5],
  ["3136", "Database Management System Lab", "Programme core course", "S3", R21, "PRACTICAL", 0, 0, 3, 1.5],
  ["3137", "Digital Computer Fundamentals Lab", "Programme core course", "S3", R21, "PRACTICAL", 0, 0, 3, 1.5],
  ["3138", "Web Technology Lab", "Programme core course", "S3", R21, "PRACTICAL", 1, 0, 3, 2.5],
  ["3139", "Computer System Hardware Lab", "Programme core course", "S3", R21, "PRACTICAL", 0, 0, 4, 0],

  // ── Fifth Semester · Revision 2021 ──────────────────────────────
  ["5009", "Internship II", "Common Courses", "S5", R21, "PRACTICAL", 0, 0, 0, 3],
  ["5002", "Project Management and Software Engineering", "Common Courses", "S5", R21, "THEORY", 4, 0, 0, 0],
  ["5131", "Embedded System and Real time Operating System", "Programme core course", "S5", R21, "THEORY", 4, 0, 0, 4],
  ["5132", "Operating System", "Programme core course", "S5", R21, "THEORY", 4, 0, 0, 4],
  ["5133A", "Virtualisation Technology and Cloud Computing", "Program Elective course", "S5", R21, "THEORY", 4, 0, 0, 4],
  ["5133B", "Ethical Hacking", "Program Elective course", "S5", R21, "THEORY", 4, 0, 0, 4],
  ["5133C", "Fundamentals of Artificial Intelligence and Machine Learning", "Program Elective course", "S5", R21, "THEORY", 4, 0, 0, 4],
  ["5137", "Embedded Systems and Real Time Operating System Lab", "Programme core course", "S5", R21, "PRACTICAL", 0, 0, 3, 1.5],
  ["5138", "System Administration Lab", "Programme core course", "S5", R21, "PRACTICAL", 0, 0, 3, 1.5],
  ["5139A", "Virtualisation Technology and Cloud Computing Lab", "Program Elective course", "S5", R21, "PRACTICAL", 0, 0, 3, 1.5],
  ["5139B", "Ethical Hacking Lab", "Program Elective course", "S5", R21, "PRACTICAL", 0, 0, 3, 1.5],
  ["5139C", "Fundamentals of Artificial Intelligence and Machine Learning Lab", "Program Elective course", "S5", R21, "PRACTICAL", 0, 0, 3, 1.5],
  ["5008", "Seminar", "Seminar", "S5", R21, "PRACTICAL", 0, 0, 2, 1],
  ["6009", "Major Project", "Major Project", "S5", R21, "PRACTICAL", 0, 0, 3, 0],

  // ── First Semester · Revision 2026 ──────────────────────────────
  ["1001", "English for Technical Communication", "Humanities & Social Sciences", "S1", R26, "THEORY", 2, 0, 2, 3],
  ["1002", "Fundamentals of Engineering Mathematics", "Basic Science", "S1", R26, "THEORY", 3, 1, 0, 4],
  ["2002B", "Engineering Physics for Applied Electrical Technology and Computing", "Basic Science", "S1", R26, "THEORY", 3, 0, 3, 4.5],
  ["2003A", "Chemistry for Engineering Practices", "Basic Science", "S1", R26, "THEORY", 3, 0, 3, 4.5],
  ["1004", "Engineering Drawing with CAD", "Engineering Science", "S1", R26, "PRACTICAL", 0, 0, 3, 1.5],
  ["1131", "Problem Solving and Python Programming", "Engineering Science", "S1", R26, "THEORY", 3, 0, 3, 4.5],
  ["1008", "Foundational IT Skills", "Engineering Science", "S1", R26, "PRACTICAL", 0, 0, 2, 1],
  ["2009B", "Engineering Workshop Practice", "Engineering Science", "S1", R26, "PRACTICAL", 0, 0, 3, 0],
  ["1009", "Health and Physical Education", "Sports & Wellness", "S1", R26, "PRACTICAL", 0, 0, 2, 0],
];

async function main() {
  await sql`ALTER TABLE subject_master_t ADD COLUMN IF NOT EXISTS scheme varchar(40)`;
  await sql`ALTER TABLE subject_master_t ADD COLUMN IF NOT EXISTS course_category varchar(120)`;
  await sql`ALTER TABLE subject_master_t ADD COLUMN IF NOT EXISTS lecture_hours integer DEFAULT 0`;
  await sql`ALTER TABLE subject_master_t ADD COLUMN IF NOT EXISTS tutorial_hours integer DEFAULT 0`;
  await sql`ALTER TABLE subject_master_t ADD COLUMN IF NOT EXISTS practical_hours integer DEFAULT 0`;
  await sql`ALTER TABLE subject_master_t ADD COLUMN IF NOT EXISTS credits numeric(4,1)`;
  console.log("✔ subject_master_t extended columns ready.");

  let added = 0, skipped = 0;
  for (const [code, name, cat, sem, scheme, type, l, t, p, credits] of SUBJECTS) {
    const dup = await sql`
      SELECT id FROM subject_master_t
      WHERE subject_code = ${code} AND scheme = ${scheme} AND display='Y' LIMIT 1`;
    if (dup.length) { skipped++; continue; }
    await sql`
      INSERT INTO subject_master_t
        (subject_code, subject_name, department_id, semester, scheme, course_category,
         subject_type, lecture_hours, tutorial_hours, practical_hours, credits, display)
      VALUES
        (${code}, ${name}, ${DEPT}, ${sem}, ${scheme}, ${cat},
         ${type}, ${l}, ${t}, ${p}, ${credits}, 'Y')`;
    added++;
  }
  console.log(`✔ Inserted ${added} subject(s), skipped ${skipped} already present.`);

  const total = await sql`SELECT count(*)::int n FROM subject_master_t WHERE display='Y'`;
  console.log(`Total active subjects: ${total[0].n}`);
  await sql.end();
}

main().catch(async (e) => {
  console.error("✖ Failed:", e.message);
  await sql.end();
  process.exit(1);
});
