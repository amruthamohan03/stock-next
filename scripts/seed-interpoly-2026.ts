/**
 * Seed the Interpoly Arts Festival 2026 register — items, participants and
 * results — from the two source documents:
 *
 *   1. "Arts Registration List" (DOC-20260622-WA0017) — the 29 students this
 *      college entered, with their individual and group items. This is the
 *      authoritative list of who took part, and gives each student's P R No,
 *      semester and programme.
 *   2. "Interpoly Certificates" — 44 Certificates of Merit (SNo. 1801-1844),
 *      each naming one student, one item and the grade won.
 *
 * The two are kept separate below exactly as they read, and joined here by
 * (student, item). That way the transcription can be checked against each PDF
 * on its own, and any certificate that does not match a registration is
 * reported rather than silently inserted.
 *
 * Results are grades only — the state festival awards A/B/C, not places, and
 * publishes no judge-wise marks, so the score columns stay null.
 *
 * Idempotent: an item already on the event (same name) is reused, and a
 * participant already on an item (same name + P R No) is left alone, so
 * re-running adds only what is missing and never overwrites edits made in the
 * UI. The event row itself is not touched.
 *
 * Usage: npx tsx scripts/seed-interpoly-2026.ts [eventId]
 */
import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const url = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/stock_db";
const sql = postgres(url, { max: 1 });

const EVENT_NAME = "Interpoly Arts Festival 2026";

/** Programme as printed → the short form used in class_name ("S4 CHE"). */
const PROGRAMME: Record<string, string> = {
  "Computer Engineering": "CE",
  "Computer Hardware Engineering": "CHE",
  "Electrical & Electronics Engineering": "EEE",
};

type Item = {
  name: string;
  category: "ON_STAGE" | "OFF_STAGE";
  itemType: "SINGLE" | "GROUP";
};

/**
 * Every item this college entered. Group items are the on-stage team entries;
 * Light Music is sung on stage; the writing and drawing items are off-stage.
 */
const ITEMS: Item[] = [
  { name: "Deshabhakthiganam", category: "ON_STAGE", itemType: "GROUP" },
  { name: "Group Song", category: "ON_STAGE", itemType: "GROUP" },
  { name: "Nadanpattu", category: "ON_STAGE", itemType: "GROUP" },
  { name: "Thiruvathirakali", category: "ON_STAGE", itemType: "GROUP" },
  { name: "Mime", category: "ON_STAGE", itemType: "GROUP" },
  { name: "Light Music (Female)", category: "ON_STAGE", itemType: "SINGLE" },
  { name: "Cartoon", category: "OFF_STAGE", itemType: "SINGLE" },
  { name: "Pencil Drawing", category: "OFF_STAGE", itemType: "SINGLE" },
  { name: "Essay Writing - Eng", category: "OFF_STAGE", itemType: "SINGLE" },
  { name: "Essay Writing - Mal", category: "OFF_STAGE", itemType: "SINGLE" },
  { name: "Poetry Writing - Eng", category: "OFF_STAGE", itemType: "SINGLE" },
  { name: "Poetry Writing - Mal", category: "OFF_STAGE", itemType: "SINGLE" },
  { name: "Story Writing - Eng", category: "OFF_STAGE", itemType: "SINGLE" },
  { name: "Story Writing - Mal", category: "OFF_STAGE", itemType: "SINGLE" },
];

/** One row of the Arts Registration List, in sheet order. */
type Reg = {
  prNo: string;
  name: string;
  semester: number;
  programme: keyof typeof PROGRAMME | string;
  gender: "Male" | "Female";
  individual: string[];
  group: string[];
};

const REGISTRATIONS: Reg[] = [
  { prNo: "2401150285", name: "SARITHAMOL K J", semester: 4, programme: "Computer Hardware Engineering", gender: "Female", individual: [], group: ["Nadanpattu", "Thiruvathirakali"] },
  { prNo: "2401150281", name: "JISNO JIJI", semester: 4, programme: "Computer Hardware Engineering", gender: "Male", individual: [], group: ["Mime"] },
  { prNo: "2401150280", name: "BENJAMIN GEORGE", semester: 4, programme: "Computer Hardware Engineering", gender: "Male", individual: ["Essay Writing - Eng", "Poetry Writing - Eng"], group: ["Mime"] },
  { prNo: "2401150277", name: "AKSHAYA SHAJI", semester: 4, programme: "Computer Hardware Engineering", gender: "Female", individual: [], group: ["Thiruvathirakali", "Group Song"] },
  { prNo: "2401150284", name: "SARATHPRASAD S", semester: 4, programme: "Computer Hardware Engineering", gender: "Male", individual: [], group: ["Mime"] },
  { prNo: "2401150282", name: "JITH SAJI", semester: 4, programme: "Computer Hardware Engineering", gender: "Male", individual: [], group: ["Mime"] },
  { prNo: "2401150287", name: "VAISHAK KM", semester: 4, programme: "Computer Hardware Engineering", gender: "Male", individual: [], group: ["Mime"] },
  { prNo: "2401150680", name: "EDWIN JOSE", semester: 4, programme: "Computer Hardware Engineering", gender: "Male", individual: [], group: ["Mime"] },
  { prNo: "2401150278", name: "ALBIN SHAJI", semester: 4, programme: "Computer Hardware Engineering", gender: "Male", individual: [], group: ["Mime"] },
  { prNo: "2401150279", name: "ARCHANA RAJESHKUMAR", semester: 4, programme: "Computer Hardware Engineering", gender: "Female", individual: [], group: ["Group Song", "Thiruvathirakali"] },
  { prNo: "2401130912", name: "ABHIJITH PRAKASH", semester: 4, programme: "Computer Engineering", gender: "Male", individual: [], group: ["Nadanpattu"] },
  { prNo: "2401130931", name: "AYOOB BIJU", semester: 4, programme: "Computer Engineering", gender: "Male", individual: [], group: ["Nadanpattu"] },
  { prNo: "2401130934", name: "BIJIL BIJU", semester: 4, programme: "Computer Engineering", gender: "Female", individual: [], group: ["Thiruvathirakali", "Deshabhakthiganam"] },
  { prNo: "2401130944", name: "MIDHUN MANOJ", semester: 4, programme: "Computer Engineering", gender: "Male", individual: [], group: ["Nadanpattu"] },
  { prNo: "2401130946", name: "NAVAMI SUNIL", semester: 4, programme: "Computer Engineering", gender: "Female", individual: [], group: ["Thiruvathirakali", "Deshabhakthiganam"] },
  { prNo: "2401130954", name: "SIYA BINOY", semester: 4, programme: "Computer Engineering", gender: "Female", individual: [], group: ["Thiruvathirakali", "Group Song"] },
  { prNo: "2501130166", name: "MEBI MOL S", semester: 2, programme: "Computer Engineering", gender: "Female", individual: [], group: ["Deshabhakthiganam", "Group Song"] },
  { prNo: "2501130167", name: "MILHA LINTO", semester: 2, programme: "Computer Engineering", gender: "Female", individual: [], group: ["Thiruvathirakali", "Group Song"] },
  { prNo: "2501130171", name: "PRAVEENA M", semester: 2, programme: "Computer Engineering", gender: "Female", individual: [], group: ["Thiruvathirakali", "Deshabhakthiganam"] },
  { prNo: "2401041141", name: "ABHIRAM P.S", semester: 4, programme: "Electrical & Electronics Engineering", gender: "Male", individual: [], group: ["Nadanpattu"] },
  { prNo: "2401041157", name: "CHRISTEENA MOL S", semester: 4, programme: "Electrical & Electronics Engineering", gender: "Female", individual: [], group: ["Nadanpattu"] },
  { prNo: "2501130146", name: "AKSAMOL SHAJI", semester: 2, programme: "Computer Engineering", gender: "Female", individual: ["Light Music (Female)"], group: ["Thiruvathirakali", "Group Song"] },
  { prNo: "2401041166", name: "PRINCYMARY J", semester: 4, programme: "Electrical & Electronics Engineering", gender: "Female", individual: [], group: ["Group Song", "Deshabhakthiganam"] },
  { prNo: "2401041172", name: "THEJAS JAYAN", semester: 4, programme: "Electrical & Electronics Engineering", gender: "Male", individual: ["Poetry Writing - Mal", "Cartoon"], group: [] },
  { prNo: "2401130949", name: "MALAVIKA S", semester: 4, programme: "Computer Engineering", gender: "Female", individual: [], group: ["Thiruvathirakali", "Deshabhakthiganam"] },
  { prNo: "2401150288", name: "VIGNESH S", semester: 4, programme: "Computer Engineering", gender: "Male", individual: ["Pencil Drawing"], group: [] },
  { prNo: "2401041170", name: "SUJITH SUNIL", semester: 4, programme: "Electrical & Electronics Engineering", gender: "Male", individual: ["Story Writing - Mal"], group: [] },
  { prNo: "2401130922", name: "ALEENA JOHNSON T J", semester: 4, programme: "Computer Engineering", gender: "Female", individual: ["Essay Writing - Mal"], group: ["Deshabhakthiganam"] },
  { prNo: "2401130947", name: "NAVANEETH KRISHNA MANOJ", semester: 4, programme: "Computer Engineering", gender: "Male", individual: ["Story Writing - Eng"], group: [] },
];

/** One Certificate of Merit: [SNo, name, item, grade]. */
type Cert = [number, string, string, "A" | "B" | "C"];

const CERTIFICATES: Cert[] = [
  [1801, "ABHIRAM P.S", "Nadanpattu", "B"],
  [1802, "CHRISTEENA MOL S", "Nadanpattu", "B"],
  [1803, "PRINCYMARY J", "Deshabhakthiganam", "A"],
  [1804, "PRINCYMARY J", "Group Song", "B"],
  [1805, "SUJITH SUNIL", "Story Writing - Mal", "B"],
  [1806, "THEJAS JAYAN", "Poetry Writing - Mal", "C"],
  [1807, "THEJAS JAYAN", "Cartoon", "C"],
  [1808, "ABHIJITH PRAKASH", "Nadanpattu", "B"],
  [1809, "ALEENA JOHNSON T J", "Deshabhakthiganam", "A"],
  [1810, "AYOOB BIJU", "Nadanpattu", "B"],
  [1811, "BIJIL BIJU", "Deshabhakthiganam", "A"],
  [1812, "BIJIL BIJU", "Thiruvathirakali", "C"],
  [1813, "MIDHUN MANOJ", "Nadanpattu", "B"],
  [1814, "NAVAMI SUNIL", "Deshabhakthiganam", "A"],
  [1815, "NAVAMI SUNIL", "Thiruvathirakali", "C"],
  [1816, "NAVANEETH KRISHNA MANOJ", "Story Writing - Eng", "A"],
  [1817, "MALAVIKA S", "Deshabhakthiganam", "A"],
  [1818, "MALAVIKA S", "Thiruvathirakali", "C"],
  [1819, "SIYA BINOY", "Group Song", "B"],
  [1820, "SIYA BINOY", "Thiruvathirakali", "C"],
  [1821, "AKSHAYA SHAJI", "Group Song", "B"],
  [1822, "AKSHAYA SHAJI", "Thiruvathirakali", "C"],
  [1823, "ALBIN SHAJI", "Mime", "B"],
  [1824, "ARCHANA RAJESHKUMAR", "Group Song", "B"],
  [1825, "ARCHANA RAJESHKUMAR", "Thiruvathirakali", "C"],
  [1826, "BENJAMIN GEORGE", "Poetry Writing - Eng", "B"],
  [1827, "BENJAMIN GEORGE", "Essay Writing - Eng", "B"],
  [1828, "BENJAMIN GEORGE", "Mime", "B"],
  [1829, "JISNO JIJI", "Mime", "B"],
  [1830, "JITH SAJI", "Mime", "B"],
  [1831, "SARATHPRASAD S", "Mime", "B"],
  [1832, "SARITHAMOL K J", "Nadanpattu", "B"],
  [1833, "SARITHAMOL K J", "Thiruvathirakali", "C"],
  [1834, "VAISHAK KM", "Mime", "B"],
  [1835, "VIGNESH S", "Pencil Drawing", "B"],
  [1836, "EDWIN JOSE", "Mime", "B"],
  [1837, "AKSAMOL SHAJI", "Group Song", "B"],
  [1838, "AKSAMOL SHAJI", "Thiruvathirakali", "C"],
  [1839, "MEBI MOL S", "Deshabhakthiganam", "A"],
  [1840, "MEBI MOL S", "Group Song", "B"],
  [1841, "MILHA LINTO", "Group Song", "B"],
  [1842, "MILHA LINTO", "Thiruvathirakali", "C"],
  [1843, "PRAVEENA M", "Deshabhakthiganam", "A"],
  [1844, "PRAVEENA M", "Thiruvathirakali", "C"],
];

/** One row to insert: a student on an item, with the grade if one was won. */
type Entry = {
  item: string;
  prNo: string;
  name: string;
  className: string;
  grade: "A" | "B" | "C" | null;
  certNo: number | null;
};

function buildEntries(): { entries: Entry[]; orphanCerts: Cert[]; unknownItems: string[] } {
  const key = (name: string, item: string) => `${name.toUpperCase()}|${item.toUpperCase()}`;
  const byKey = new Map<string, Cert>();
  for (const c of CERTIFICATES) byKey.set(key(c[1], c[2]), c);

  const known = new Set(ITEMS.map((i) => i.name.toUpperCase()));
  const unknownItems = new Set<string>();
  const used = new Set<string>();
  const entries: Entry[] = [];

  for (const r of REGISTRATIONS) {
    const className = `S${r.semester} ${PROGRAMME[r.programme] ?? r.programme}`;
    for (const item of [...r.individual, ...r.group]) {
      if (!known.has(item.toUpperCase())) unknownItems.add(item);
      const k = key(r.name, item);
      const cert = byKey.get(k);
      if (cert) used.add(k);
      entries.push({
        item,
        prNo: r.prNo,
        name: r.name,
        className,
        grade: cert ? cert[3] : null,
        certNo: cert ? cert[0] : null,
      });
    }
  }

  // A certificate with no matching registration row would mean one of the two
  // transcriptions is wrong, so it is reported instead of being inserted.
  const orphanCerts = CERTIFICATES.filter((c) => !used.has(key(c[1], c[2])));
  return { entries, orphanCerts, unknownItems: [...unknownItems] };
}

async function main() {
  const argId = Number(process.argv[2]);
  const [event] = argId
    ? await sql`SELECT id, name, academic_year FROM event_t WHERE id = ${argId} AND display = 'Y'`
    : await sql`SELECT id, name, academic_year FROM event_t WHERE display = 'Y' AND lower(name) = lower(${EVENT_NAME}) ORDER BY id LIMIT 1`;

  if (!event) {
    console.error(`✖ Event not found (${argId ? `id ${argId}` : EVENT_NAME}). Create it first, or pass an id.`);
    await sql.end();
    process.exit(1);
  }

  const { entries, orphanCerts, unknownItems } = buildEntries();
  if (unknownItems.length) {
    console.error(`✖ Registered items missing from ITEMS: ${unknownItems.join(", ")}`);
    await sql.end();
    process.exit(1);
  }

  console.log(`Seeding into event ${event.id} — ${event.name} (${event.academic_year ?? "no year"})`);
  console.log(`${REGISTRATIONS.length} students, ${entries.length} entries, ${CERTIFICATES.length} certificates\n`);

  const [{ max }] = await sql`
    SELECT COALESCE(MAX(sort_order), 0) AS max FROM event_item_t
    WHERE event_id = ${event.id} AND display = 'Y'
  `;
  let order = Number(max);

  let itemsCreated = 0;
  let added = 0;
  let skipped = 0;
  let graded = 0;

  for (const def of ITEMS) {
    const rows = entries.filter((e) => e.item === def.name);
    if (rows.length === 0) continue;

    let [item] = await sql`
      SELECT id FROM event_item_t
      WHERE event_id = ${event.id} AND display = 'Y' AND lower(name) = lower(${def.name})
      LIMIT 1
    `;
    if (!item) {
      order++;
      [item] = await sql`
        INSERT INTO event_item_t (event_id, name, category, item_type, sort_order, display)
        VALUES (${event.id}, ${def.name}, ${def.category}, ${def.itemType}, ${order}, 'Y')
        RETURNING id
      `;
      itemsCreated++;
    }

    let a = 0;
    let k = 0;
    let g = 0;
    for (const [i, e] of rows.entries()) {
      const dup = await sql`
        SELECT id FROM event_participant_t
        WHERE item_id = ${item.id} AND display = 'Y'
          AND lower(participant_name) = lower(${e.name})
          AND coalesce(chest_no, '') = ${e.prNo}
        LIMIT 1
      `;
      if (dup.length > 0) {
        k++;
        continue;
      }
      // The P R No is the identifier the state register uses, so it goes in
      // chest_no; the certificate serial is kept in remarks for traceability.
      await sql`
        INSERT INTO event_participant_t
          (item_id, chest_no, participant_name, class_name, grade, remarks, sort_order, display)
        VALUES
          (${item.id}, ${e.prNo}, ${e.name}, ${e.className}, ${e.grade},
           ${e.certNo ? `Certificate of Merit SNo. ${e.certNo}` : null}, ${i + 1}, 'Y')
      `;
      a++;
      if (e.grade) g++;
    }
    added += a;
    skipped += k;
    graded += g;
    const label = `${def.name} (${def.itemType === "GROUP" ? "group" : "single"})`;
    console.log(`✔ ${label.padEnd(34)} ${String(a).padStart(2)} added${k ? `, ${k} already there` : ""}${g ? `, ${g} graded` : ""}`);
  }

  console.log(`\n✔ ${itemsCreated} items created, ${added} participants added, ${skipped} already present, ${graded} with a grade.`);

  if (orphanCerts.length) {
    console.log("\n⚠ Certificates with no matching registration (nothing inserted for these):");
    for (const c of orphanCerts) console.log(`   SNo. ${c[0]}  ${c[1]} — ${c[2]} (${c[3]})`);
  }

  const ungraded = await sql`
    SELECT i.name AS item, p.participant_name AS who
    FROM event_participant_t p
    JOIN event_item_t i ON i.id = p.item_id
    WHERE i.event_id = ${event.id} AND i.display = 'Y' AND p.display = 'Y' AND p.grade IS NULL
    ORDER BY i.name, p.participant_name
  `;
  if (ungraded.length) {
    console.log("\nEntries with no certificate (participated, no grade published):");
    for (const r of ungraded) console.log(`   ${r.item} — ${r.who}`);
  }

  const summary = await sql`
    SELECT i.name AS item, i.category, i.item_type,
           count(p.id)::int AS entries,
           count(*) FILTER (WHERE p.grade = 'A')::int AS a,
           count(*) FILTER (WHERE p.grade = 'B')::int AS b,
           count(*) FILTER (WHERE p.grade = 'C')::int AS c
    FROM event_item_t i
    LEFT JOIN event_participant_t p ON p.item_id = i.id AND p.display = 'Y'
    WHERE i.event_id = ${event.id} AND i.display = 'Y'
    GROUP BY i.name, i.category, i.item_type, i.sort_order
    ORDER BY i.sort_order
  `;
  console.log("");
  console.table(summary.map((r) => ({ ...r })));

  await sql.end();
}

main().catch(async (e) => {
  console.error("✖ Failed:", e.message);
  await sql.end();
  process.exit(1);
});
