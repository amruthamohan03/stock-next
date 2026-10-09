/**
 * Seed the MASTHI 2K26 off-stage events and their coordinators, transcribed
 * from the signed "DUTY LIST (OFF STAGE EVENTS)" sheet dated 02/02/2026.
 *
 * Items are created in the order they appear on the printed page. Note the
 * sheet's own Sl.No column runs 1-8, then 14, then 9-13, then 15 — Colash and
 * Speech were evidently added late. The page order is preserved here, so the
 * app renumbers them 1-15 sequentially.
 *
 * Coordinators are linked to staff_t when the name matches the register, and
 * stored as plain text otherwise (the duty route supports both, for outside
 * judges and staff who are not on the register).
 *
 * Idempotent — an item already present on the event by name is left alone.
 * Usage: npx tsx scripts/seed-masthi-offstage.ts [eventId]
 */
import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const url = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/stock_db";
const sql = postgres(url, { max: 1 });

/** One row of the printed duty list. */
type Row = { item: string; date: string; time: string; coordinator: string };

const ROWS: Row[] = [
  { item: "Story Writing(Malayalam)", date: "2026-02-02", time: "1PM -2PM", coordinator: "Madhu G" },
  { item: "Story Writing(English)", date: "2026-02-02", time: "1PM -2PM", coordinator: "Leena Alphons Mary" },
  { item: "Story Writing(Tamil)", date: "2026-02-02", time: "2PM -3PM", coordinator: "Radhakrishnan" },
  { item: "Essay Writing(Malayalam)", date: "2026-02-03", time: "1PM -2PM", coordinator: "Siby Paul" },
  { item: "Essay Writing(English)", date: "2026-02-03", time: "2PM -3PM", coordinator: "Ancy Stalin" },
  { item: "Poem Writing(Malayalam)", date: "2026-02-04", time: "1PM -2PM", coordinator: "Justin Augustine" },
  { item: "Poem Writing(English)", date: "2026-02-04", time: "2PM -3PM", coordinator: "Sreejith P R" },
  { item: "Poem Writing(Tamil)", date: "2026-02-04", time: "1PM -2PM", coordinator: "Radhakrishnan" },
  // Sl.No 14 on the sheet, printed here between 8 and 9.
  { item: "Colash", date: "2026-02-04", time: "1PM -2PM", coordinator: "Santhosh I" },
  { item: "Pencil Drawing", date: "2026-02-05", time: "1PM -2PM", coordinator: "Anju Mohanan" },
  { item: "Cartoon", date: "2026-02-05", time: "2PM -3PM", coordinator: "Bibin Jose" },
  { item: "Poetry Recitation (Malayalam)", date: "2026-02-06", time: "1PM -2PM", coordinator: "Anu Joseph" },
  { item: "Poetry Recitation(English)", date: "2026-02-06", time: "1PM -2PM", coordinator: "Kavya Saji" },
  { item: "Poetry Recitation(Tamil)", date: "2026-02-06", time: "2PM -3PM", coordinator: "Radhakrishnan" },
  // Sl.No 15 on the sheet.
  { item: "Speech(Malayalam)", date: "2026-02-02", time: "2PM -3PM", coordinator: "Ajumon Babu" },
];

type Staff = { id: number; staff_name: string };

/**
 * Match a coordinator to the staff register.
 *
 * Exact (case-insensitive) first. Otherwise a single unambiguous prefix match
 * — the sheet writes "Radhakrishnan" where the register has "Radhakrishnan G".
 * Anything ambiguous stays unlinked rather than guessing at a person.
 */
function matchStaff(name: string, staff: Staff[]): { staff: Staff | null; how: string } {
  const key = name.trim().toLowerCase();
  const exact = staff.filter((s) => s.staff_name.trim().toLowerCase() === key);
  if (exact.length === 1) return { staff: exact[0], how: "exact" };

  const prefix = staff.filter((s) => s.staff_name.trim().toLowerCase().startsWith(key + " "));
  if (prefix.length === 1) return { staff: prefix[0], how: `prefix → "${prefix[0].staff_name}"` };
  if (prefix.length > 1) return { staff: null, how: "ambiguous, left as text" };

  return { staff: null, how: "not on the register, stored as text" };
}

async function main() {
  const eventId = Number(process.argv[2] ?? 6);

  const [event] = await sql`
    SELECT id, name, subtitle FROM event_t WHERE id = ${eventId} AND display = 'Y'
  `;
  if (!event) {
    console.error(`✖ Event ${eventId} not found (or soft-deleted).`);
    await sql.end();
    process.exit(1);
  }
  console.log(`Seeding into event ${event.id} — ${event.name}${event.subtitle ? ` (${event.subtitle})` : ""}\n`);

  const staff = (await sql`
    SELECT id, staff_name FROM staff_t WHERE display = 'Y'
  `) as unknown as Staff[];

  // Continue the running order after whatever is already on the event.
  const [{ max }] = await sql`
    SELECT COALESCE(MAX(sort_order), 0) AS max FROM event_item_t
    WHERE event_id = ${eventId} AND display = 'Y'
  `;
  let order = Number(max);

  let added = 0;
  let skipped = 0;
  const unlinked: string[] = [];

  for (const row of ROWS) {
    const existing = await sql`
      SELECT id FROM event_item_t
      WHERE event_id = ${eventId} AND display = 'Y' AND lower(name) = lower(${row.item})
      LIMIT 1
    `;
    if (existing.length > 0) {
      console.log(`• ${row.item} — already present, left alone.`);
      skipped++;
      continue;
    }

    order++;
    const [item] = await sql`
      INSERT INTO event_item_t
        (event_id, name, category, item_type, venue, scheduled_date, scheduled_time, sort_order, display)
      VALUES
        (${eventId}, ${row.item}, 'OFF_STAGE', 'SINGLE', NULL,
         ${row.date}, ${row.time}, ${order}, 'Y')
      RETURNING id
    `;

    const { staff: matched, how } = matchStaff(row.coordinator, staff);
    if (!matched) unlinked.push(row.coordinator);
    await sql`
      INSERT INTO event_duty_t (item_id, staff_id, person_name, duty_role, sort_order, display)
      VALUES (${item.id}, ${matched?.id ?? null}, ${matched?.staff_name ?? row.coordinator},
              'COORDINATOR', 0, 'Y')
    `;

    console.log(`✔ ${String(order).padStart(2)} ${row.item.padEnd(30)} ${row.date} ${row.time.padEnd(9)} ${row.coordinator} [${how}]`);
    added++;
  }

  console.log(`\n✔ ${added} added, ${skipped} already present.`);
  if (unlinked.length) {
    console.log(
      `\nNot on the staff register, stored as plain names:\n  ${[...new Set(unlinked)].join(", ")}` +
        `\nAdd them under /staff and re-run to link them.`
    );
  }

  const check = await sql`
    SELECT i.sort_order, i.name, i.scheduled_date, i.scheduled_time,
           d.person_name, d.staff_id
    FROM event_item_t i
    LEFT JOIN event_duty_t d ON d.item_id = i.id AND d.display = 'Y' AND d.duty_role = 'COORDINATOR'
    WHERE i.event_id = ${eventId} AND i.display = 'Y' AND i.category = 'OFF_STAGE'
    ORDER BY i.sort_order
  `;
  console.log(`\nOff-stage programme now on the event (${check.length}):`);
  console.table(
    check.map((r) => ({
      "#": r.sort_order,
      item: r.name,
      date: String(r.scheduled_date).slice(0, 10),
      time: r.scheduled_time,
      coordinator: r.person_name,
      staff: r.staff_id ?? "—",
    }))
  );

  await sql.end();
}

main().catch(async (e) => {
  console.error("✖ Failed:", e.message);
  await sql.end();
  process.exit(1);
});
