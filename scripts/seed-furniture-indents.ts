/**
 * Seed the handwritten indents from the furniture indent book — the paper
 * forms "Department of Technical Education · Engineering College / Govt.
 * Polytechnic, Nedumkandam", Book No. 1.
 *
 *   Indent  1 · 23-09-2010 · CT Department   — 24 items of furniture
 *   Indent  2 · 20-10-2010 · CT Department   — projector and processors
 *   Indent  3 · 25-02-2011 · Computer Hardware
 *                            Maintenance Engg. — benches, desks, computer tops
 *   Indent  4 · 18-12-2018 · Computer Engg.  — Sl. 1-7, spread over three sheets
 *   Indent  5 · 18-12-2018 · Computer Engg.  — 100 Jefferson chairs for the hall
 *   Indent  6 · 28-11-2019 · CT Lab          — notice board
 *   Indent  7 · 27-02-2020 · CT Department   — lab furniture
 *   Indent  8 · 03-07-2020 · CT Department   — white board and steel cabinet
 *   Indent  9 · 25-02-2021 · CT Department   — cabinets and boards
 *   Indent 10 · 13-03-2024 · Seminar Hall    — platform, podium, 100 chairs
 *
 * Each particular needs a row in item_master_t, because indent_item_t.item_id
 * is NOT NULL. Items are matched by name first and only created when missing,
 * so re-running never duplicates the master. The particular as written on the
 * form is kept verbatim in item_description, which is what the indent prints.
 *
 * Quantities are transcribed as intended / passed / issued; on these forms all
 * three match, and every sheet is signed off as issued and received, so the
 * indents are seeded at status RECEIVED.
 *
 * Idempotent: an indent already in the book (same book + indent no) is left
 * alone. Usage: npx tsx scripts/seed-furniture-indents.ts [indentBookId]
 */
import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const url = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/stock_db";
const sql = postgres(url, { max: 1 });

const BOOK_NAME = "Furniture Indent Book";
const FURNITURE = 1; // quotation_categories_t — Furniture
const ELECTRONIC = 2; // quotation_categories_t — Electronic Equipments

/** [sl, item master name, particulars as written, purpose, qty, category, remarks?] */
type Row = [number, string, string, string | null, number, number, string?];

type Indent = {
  indent_no: string;
  indent_date: string;
  department_id: number;
  /** As written on the form, for the record. */
  department_label: string;
  item_type: "N" | "C";
  purpose: string | null;
  rows: Row[];
};

const INDENTS: Indent[] = [
  {
    indent_no: "1",
    indent_date: "2010-09-23",
    department_id: 1,
    department_label: "CT Department",
    item_type: "N",
    purpose: "Furniture for class rooms, staff room, lab and workshop",
    rows: [
      [1, "Iron Bench with Back and Slope Desk", "Iron bench with back and slop desk", "Class room use", 13, FURNITURE],
      [2, "Anjeli Wood Drawing Stool", "Anjeli wood drawing stool", "Class room use", 17, FURNITURE],
      [3, "A.W. Double Drawer Table", "A.W. Double drawer table", "Staff room", 9, FURNITURE],
      [4, "A.W. Single Drawer Table", "A.W. Single drawer table", "Staff room", 5, FURNITURE],
      [5, "Computer Table", "Computer table", "Lab use", 5, FURNITURE],
      [6, "Computer Chair Revolving", "Computer chair revolving, cushion seat and back", "Lab use", 2, FURNITURE],
      [7, "Metal Chair Plastic Tone", "Metal chair plastic tone", "Staff room", 3, FURNITURE],
      [8, "Metal Table Mica Top", "Metal table mica top", "Lab", 1, FURNITURE],
      [9, "Steel Shelving Cabinet Large", "Steel shelving cabinet large", "Lab", 5, FURNITURE],
      [10, "Metal Side Rack", "Metal side rack", "Lab", 2, FURNITURE],
      [11, "Drawing Board with Drawing Table", "Drawing board with drawing table", "Class room", 17, FURNITURE],
      [12, "Plane Table with Tubular Frame", "Plane table with tubular frame", "Lab", 4, FURNITURE],
      [13, "A.W. Bench with Back", "A.W. Bench with back", "Class room", 12, FURNITURE],
      [14, "A.W. Slope Desk with Shelf", "A.W. Slope desk with shelf", "Class room", 12, FURNITURE],
      [15, "D.W. Arm Chair Plastic Seat", "D.W. Arm chair plastic seat", "Staff room", 5, FURNITURE],
      [16, "A.W. Armless Chair", "A.W. Armless chair", "Staff room", 2, FURNITURE],
      [17, "A.W. Stool", "A.W. Stool", "Staff room", 8, FURNITURE],
      [18, "A.W. Drawing Board with Stand", "A.W. Drawing board with stand", "Class room", 33, FURNITURE],
      [19, "A.W. Drawing Stool", "A.W. Drawing stool", "Class room", 17, FURNITURE],
      [20, "A.W. Work Bench without Cupboard", "A.W. Work bench without cup board", "Workshop", 2, FURNITURE],
      [21, "A.W. Plane Table (Small)", "A.W. Plane table (small)", "Class room", 2, FURNITURE],
      [22, "Students Notice Board", "Students notice board", "Class room", 1, FURNITURE],
      [
        23,
        "Steel Desk",
        "Steel desk with steel angle frame",
        "Class room",
        4,
        FURNITURE,
        "Handwriting unclear on the original — verify Sl. 23 against the paper indent",
      ],
      [24, "A.W. Bench with Back Rest", "A.W. Bench with back rest", "Class room", 4, FURNITURE],
    ],
  },
  {
    indent_no: "2",
    indent_date: "2010-10-20",
    department_id: 1,
    department_label: "CT Department",
    item_type: "N",
    purpose: "Projector and processors for the class room",
    rows: [
      [1, "Acer P1100 Projector", "Acer P1100 MM Projector", "Class room", 1, ELECTRONIC],
      [2, "Ceiling Mount Kit for Projector", "Ceiling mount kit for projector", "Class room", 1, ELECTRONIC],
      [
        3,
        "Intel Atom N450 / N550 Processor",
        "Intel Atom M 450 N550 processor",
        null,
        2,
        ELECTRONIC,
        "Purpose column left blank on the original",
      ],
    ],
  },
  {
    indent_no: "3",
    indent_date: "2011-02-25",
    department_id: 2,
    department_label: "Computer Hardware Maintenance Engineering",
    item_type: "N",
    purpose: "Furniture for the class room and computer lab",
    rows: [
      [1, "A.W. Bench", "A.W. Bench", "Class room", 10, FURNITURE],
      [2, "A.W. Desk", "A.W. Desk", "Class room", 10, FURNITURE],
      [
        3,
        "A.W. Computer Table Novapan Top with Keyboard Tray",
        "A.W. Computer, Novapan top and key board",
        "Lab",
        10,
        FURNITURE,
      ],
    ],
  },
  {
    // Sl. 01-07 run across three sheets of the same indent.
    indent_no: "4",
    indent_date: "2018-12-18",
    department_id: 1,
    department_label: "Computer Engineering Department",
    item_type: "N",
    purpose: "Furniture for the computer labs, staff room and class rooms",
    rows: [
      [1, "Computer Table", "Computer table 120 x 60 x 75 cm (20 g) with metal CPU provision", "Computer labs", 20, FURNITURE],
      [2, "Computer Chair with Arm", "Computer chair with arm", "Computer labs", 20, FURNITURE],
      [3, "Executive Revolving Chair", "Executive revolving chair", "CT HoD room", 1, FURNITURE],
      [4, "Steel Table with Cupboard and Drawer", "Steel table with 1 cupboard and 1 drawer 120 x 60 x 75 cm (20 gms)", "CT staff room", 7, FURNITURE],
      [
        5,
        "Steel S Type Arm Chair",
        "Steel S type arm chair",
        "CT department",
        7,
        FURNITURE,
        "Intended quantity reads 02 or 07 on the original; passed and issued are both 07 — verify Sl. 5",
      ],
      [6, "Steel Frame Bench with Wooden Top", "Steel frame bench with wooden top (160 x 30 x 65 cm)", "Class room", 10, FURNITURE],
      [7, "Steel Frame Desk with Wooden Top", "Steel frame desk with wooden top (160 x 42.5 x 75 cm)", "Class room", 10, FURNITURE],
    ],
  },
  {
    indent_no: "5",
    indent_date: "2018-12-18",
    department_id: 1,
    department_label: "Computer Engineering Department",
    item_type: "N",
    purpose: "Seating for the hall",
    rows: [
      [
        1,
        "Jefferson Chair",
        "Jefferson chair, jammer pedestalled steel",
        "Hall",
        100,
        FURNITURE,
      ],
    ],
  },
  {
    indent_no: "6",
    indent_date: "2019-11-28",
    department_id: 1,
    department_label: "CT Lab",
    item_type: "N",
    purpose: "Notice board for the CT lab",
    rows: [
      [
        1,
        "Notice Board with Glass Shutter",
        "Notice board with glass shutter",
        "CT lab",
        1,
        FURNITURE,
        "Sl. No. column left blank on the original",
      ],
    ],
  },
  {
    indent_no: "7",
    indent_date: "2020-02-27",
    department_id: 1,
    department_label: "CT Department",
    item_type: "N",
    purpose: "Furniture for the CT lab",
    rows: [
      [1, "Pre-Laminated Board Table with Drawer and Cupboard", "Pre laminated board table with 1 drawer and 1 cupboard", "CT lab", 10, FURNITURE],
      [2, "Computer Chair with Arm", "Computer chair with arm", "CT lab", 20, FURNITURE],
      [3, "Shoe Rack", "Shoe rack", "CT lab", 3, FURNITURE],
      [4, "Hardwood Notice Board with Glass Shutter", "Hardwood notice board in glass shutter", "CT lab", 3, FURNITURE],
    ],
  },
  {
    indent_no: "8",
    indent_date: "2020-07-03",
    department_id: 1,
    department_label: "CT Department",
    item_type: "N",
    purpose: "Board and cabinet for the CT lab",
    rows: [
      [1, "White Board with Aluminium Frame", "White board with aluminium frame 180 x 120 cm", "CT lab", 1, FURNITURE],
      [2, "Steel Cabinet with 4 Fixed Shelves", "Steel cabinet with 4 fixed shelves 198 x 90 x 48 cm", "CT lab", 3, FURNITURE],
    ],
  },
  {
    indent_no: "9",
    indent_date: "2021-02-25",
    department_id: 1,
    department_label: "CT Department",
    item_type: "N",
    purpose: "Cabinets and boards for the staff rooms, lab and class rooms",
    rows: [
      [1, "Steel Cabinet with 4 Fixed Shelves", "Steel cabinet with 4 fixed shelves 78 x 36 x 19", "Faculty (staff rooms)", 5, FURNITURE],
      [2, "White Board with Aluminium Frame", "White board with aluminium frame, size 240 x 120 cm", "CT lab and class rooms", 5, FURNITURE],
    ],
  },
  {
    indent_no: "10",
    indent_date: "2024-03-13",
    department_id: 1,
    department_label: "Seminar Hall",
    item_type: "N",
    purpose: "Furniture for the seminar hall",
    rows: [
      [
        1,
        "Hardwood Platform",
        "HW platform",
        "Seminar hall",
        1,
        FURNITURE,
        "Written as \"HW\" on the original, read as hardwood",
      ],
      [
        2,
        "Hardwood Podium",
        "HW podium",
        "Seminar hall",
        1,
        FURNITURE,
        "Written as \"HW\" on the original, read as hardwood",
      ],
      [3, "Jefferson Chair", "Jefferson chair", "Seminar hall", 100, FURNITURE],
    ],
  },
];

/** Find an item by name, or create it. Returns its id. */
async function itemId(name: string, categoryId: number, created: string[]) {
  const [found] = await sql`
    SELECT id FROM item_master_t
    WHERE display = 'Y' AND lower(item_name) = lower(${name})
    LIMIT 1
  `;
  if (found) return Number(found.id);

  const [row] = await sql`
    INSERT INTO item_master_t (item_name, category_id, tax_not_tax, display, created_by)
    VALUES (${name}, ${categoryId}, 'N', 'Y', 1)
    RETURNING id
  `;
  created.push(name);
  return Number(row.id);
}

async function main() {
  const argId = Number(process.argv[2]);
  const [book] = argId
    ? await sql`SELECT id, book_name, book_no FROM indent_book_t WHERE id = ${argId} AND display = 'Y'`
    : await sql`SELECT id, book_name, book_no FROM indent_book_t WHERE display = 'Y' AND lower(book_name) = lower(${BOOK_NAME}) LIMIT 1`;

  if (!book) {
    console.error(`✖ Indent book not found (${argId ? `id ${argId}` : BOOK_NAME}). Add it under Masters → Indent Book, or pass an id.`);
    await sql.end();
    process.exit(1);
  }
  const bookId = Number(book.id);
  console.log(`Seeding into indent book ${bookId} — ${book.book_name} (Book No ${book.book_no ?? "—"})\n`);

  const createdItems: string[] = [];
  let indentsAdded = 0;
  let itemsAdded = 0;
  const skipped: string[] = [];

  for (const ind of INDENTS) {
    const existing = await sql`
      SELECT id FROM indent_master_t
      WHERE book_no = ${bookId} AND indent_no = ${ind.indent_no} AND display = 'Y'
      LIMIT 1
    `;
    if (existing.length > 0) {
      skipped.push(`Indent ${ind.indent_no} (already in this book as id ${existing[0].id})`);
      continue;
    }

    const [header] = await sql`
      INSERT INTO indent_master_t
        (book_no, indent_no, indent_date, purpose, item_type, department_id,
         institution_id, created_by, status, display)
      VALUES
        (${bookId}, ${ind.indent_no}, ${ind.indent_date}, ${ind.purpose}, ${ind.item_type},
         ${ind.department_id}, 1, 1, 'RECEIVED', 'Y')
      RETURNING id
    `;
    const indentId = Number(header.id);
    indentsAdded++;

    for (const [sl, name, particulars, purpose, qty, category, remarks] of ind.rows) {
      const id = await itemId(name, category, createdItems);
      await sql`
        INSERT INTO indent_item_t
          (indent_id, sl_no, item_id, item_description, item_purpose,
           qty_intended, qty_passed, qty_issued, remarks, status_id, display)
        VALUES
          (${indentId}, ${sl}, ${id}, ${particulars}, ${purpose},
           ${qty}, ${qty}, ${qty}, ${remarks ?? null}, 1, 'Y')
      `;
      itemsAdded++;
    }

    const total = ind.rows.reduce((n, r) => n + r[4], 0);
    console.log(
      `✔ Indent ${ind.indent_no.padEnd(2)} ${ind.indent_date} · ${ind.department_label.padEnd(42)} ` +
        `${String(ind.rows.length).padStart(2)} lines, ${String(total).padStart(3)} units (id ${indentId})`
    );
  }

  console.log(`\n✔ ${indentsAdded} indents added, ${itemsAdded} line items, ${createdItems.length} new items in the item master.`);
  if (skipped.length) console.log(`• Skipped: ${skipped.join("; ")}`);
  if (createdItems.length) console.log(`\nItems created:\n  ${createdItems.join("\n  ")}`);

  const check = await sql`
    SELECT im.indent_no, im.indent_date, d.department_name AS department, im.status,
           count(ii.id)::int AS lines, COALESCE(SUM(ii.qty_issued), 0)::int AS units
    FROM indent_master_t im
    LEFT JOIN indent_item_t ii ON ii.indent_id = im.id AND ii.display = 'Y'
    LEFT JOIN department_master_t d ON d.id = im.department_id
    WHERE im.book_no = ${bookId} AND im.display = 'Y'
    GROUP BY im.id, im.indent_no, im.indent_date, d.department_name, im.status
    ORDER BY im.indent_no
  `;
  console.log("");
  console.table(check.map((r) => ({ ...r, indent_date: String(r.indent_date).slice(0, 10) })));

  const flagged = await sql`
    SELECT im.indent_no, ii.sl_no, ii.item_description, ii.remarks
    FROM indent_item_t ii
    JOIN indent_master_t im ON im.id = ii.indent_id
    WHERE im.book_no = ${bookId} AND ii.remarks IS NOT NULL AND ii.display = 'Y'
    ORDER BY im.indent_no, ii.sl_no
  `;
  if (flagged.length) {
    console.log("Lines needing a check against the paper indent:");
    for (const f of flagged) console.log(`   Indent ${f.indent_no} Sl. ${f.sl_no} — ${f.item_description}: ${f.remarks}`);
  }

  await sql.end();
}

main().catch(async (e) => {
  console.error("✖ Failed:", e.message);
  await sql.end();
  process.exit(1);
});
