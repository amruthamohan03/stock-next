/**
 * Seed the MASTHI 2K26 registration lists — on-stage and off-stage — from the
 * two "MASTI_2K26_Registration_Form" workbooks.
 *
 * Off-stage lists attach to the items already created from the duty list. The
 * workbooks group some sheets by language (a main list, then TAMIL, then
 * ENGLISH blocks), and those map onto the separate per-language items.
 *
 * On-stage items do not exist yet, so they are created here from the sheet
 * names. They carry no date/time: the registration sheets give none, and the
 * Stage 1 duty list is a separate document.
 *
 * Transcribed verbatim — spellings, duplicate chest numbers and all. Two
 * things the script deliberately does NOT resolve, see the notes it prints:
 *   - "SA Writing" has no matching item; it is created under its own name
 *     rather than merged into Essay Writing on a guess.
 *   - "Cartoon Drawing" is dated 06-02-2026 here but 05-02-2026 on the duty
 *     list; the existing item keeps its duty-list date.
 *
 * Idempotent — a participant already on the item (same name + chest no) is
 * left alone, so re-running adds only what is missing.
 * Usage: npx tsx scripts/seed-masthi-participants.ts [eventId]
 */
import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const url = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/stock_db";
const sql = postgres(url, { max: 1 });

/** [name, class, chest no] — one registration row. */
type P = [string, string, string];

type Sheet = {
  /** Heading on the registration sheet, for the report. */
  sheet: string;
  /** Item name in the app. Created if it does not exist. */
  item: string;
  category: "ON_STAGE" | "OFF_STAGE";
  itemType?: "SINGLE" | "GROUP";
  date?: string;
  time?: string;
  people: P[];
};

const OFF_STAGE: Sheet[] = [
  {
    sheet: "Cartoon Drawing (06-02-2026 1 PM to 3 PM)",
    item: "Cartoon",
    category: "OFF_STAGE",
    people: [
      ["Anandhu Krishnan", "S6 CT", "101"],
      ["Muhammad Thahir S", "S6 CT", "115"],
      ["Arjun S.S", "S6 CT", "119"],
      ["Abhijith BS", "S4 CT", "103"],
      ["Sidharth Anoop", "S4 CT", "111"],
      ["Ajay A", "S4 CT", "112"],
      ["Bimal Viju", "S4 CT", "113"],
      ["Akash Shaji", "S4 CT", "116"],
      ["Thejas Jayan", "S4 EL", "105"],
      ["Abhiram P S", "S4 EL", "118"],
      ["Praveen Raja", "S2 CHM", "104"],
      ["Sijumon R", "S2 CHM", "110"],
      ["Jaidhav P.A", "S2 CT", "106"],
      ["Milha Linto", "S2 CT", "107"],
      ["Kasyap C B", "S2 CT", "108"],
      ["Abinav C Rajesh", "S2 CT", "117"],
      ["Dhanooj Jestin", "S2 EL", "109"],
    ],
  },
  {
    sheet: "Poem Writing (04-02-2026) — main list",
    item: "Poem Writing(Malayalam)",
    category: "OFF_STAGE",
    people: [
      ["Arjun S.S", "S6 CT", "108"],
      ["Anandhu krishnan", "S6 CT", "110"],
      ["Muhammad Thahir", "S6 CT", "118"],
      ["Adhithyan M", "S6 CT", "119"],
      ["Daniya Sojan", "S4 CT", "101"],
      ["Akash Shaji", "S4 CT", "109"],
      ["Abhijith B.S", "S4 CT", "119"],
      ["Thejas Jayan", "S4 EL", "106"],
      ["Christeena Mol S", "S4 EL", "107"],
      ["Adhithyan V.Jayan", "S4 EL", "121"],
      ["Abhiram P S", "S4 EL", "112"],
      ["Saritha Mol K", "S4 CHE", "113"],
      ["Milha Linto", "S2 CT", "114"],
      ["Jaidhev P.A", "S2 CT", "115"],
      ["Joshua Johns", "S2 CT", "116"],
      ["Kasyap C.B", "S2 CT", "120"],
      ["Arshad Shajahan", "S2 CT", "122"],
      ["Sachin V.U", "S2 CT", "123"],
    ],
  },
  {
    sheet: "Poem Writing — TAMIL",
    item: "Poem Writing(Tamil)",
    category: "OFF_STAGE",
    people: [
      ["Karthik K", "S2 CHM", "103"],
      ["Dharun V", "S2 CHM", "104"],
      ["Sreevarshan", "S2 CT", "105"],
    ],
  },
  {
    sheet: "Poem Writing — ENGLISH",
    item: "Poem Writing(English)",
    category: "OFF_STAGE",
    people: [
      ["Arjun S S", "S6 CT", "108"],
      ["Joshua Johns", "S2 CT", "116"],
    ],
  },
  {
    sheet: "SA Writing (03-02-2026 1 PM to 3 PM) — main list",
    item: "SA Writing",
    category: "OFF_STAGE",
    date: "2026-02-03",
    time: "1PM -3PM",
    people: [
      ["Vijaya lakshmi", "S6 CT", "109"],
      ["Abhiraj S", "S6 CT", "113"],
      ["Albin Siby", "S6 CT", "114"],
      ["Amjith soy", "S6 CT", "115"],
      ["Amose Rajeev", "S6 CT", "116"],
      ["Devananth KS", "S6 CT", "117"],
      ["Ajith KG", "S6 CT", "118"],
      ["Sandhra Shijo", "S6 CT", "119"],
      ["Aswin KS", "S6 CT", "120"],
      ["Abhijith Prakash", "S6 CT", "121"],
      ["Christeena Sabu", "S6 CT", "122"],
      ["Amal saji", "S6 CT", "127"],
      ["Ajin shaji", "S6 CHE", "112"],
      ["Archana Binu", "S6 CHE", "111"],
      ["Abhijith B S", "S4 CT", "103"],
      ["Akash Shaji", "S4 CT", "104"],
      ["Dania Sojan", "S4 CT", "105"],
      ["Sidharth Anoop", "S4 CT", "125"],
      ["JOSEPH.E.J", "S4 CT", "126"],
      ["Ayoob Biju", "S4 CT", "128"],
      ["Anandhu Biju", "S4 CT", "129"],
      ["Aleena Johnson T J", "S4 CT", "130"],
      ["NavaneethKrishna Manoj", "S4 CT", "131"],
      ["Christeena Mol S", "S4 EL", "123"],
      ["Rinson Devasya", "S4 EL", "124"],
      ["Sachin", "S2 CT", "106"],
      ["Sreejith M S", "S2 CT", "107"],
      ["Jaidev B.A", "S2 CT", "108"],
      ["Milha", "S2 CT", "132"],
    ],
  },
  {
    sheet: "SA Writing — TAMIL",
    item: "SA Writing(Tamil)",
    category: "OFF_STAGE",
    date: "2026-02-03",
    time: "1PM -3PM",
    people: [["Sreevarshan M", "S2 CT", "101"]],
  },
  {
    sheet: "Story Writing (02-02-2026 1 PM to 3 PM) — main list",
    item: "Story Writing(Malayalam)",
    category: "OFF_STAGE",
    people: [
      ["Adhithyan M", "S6 CT", "102"],
      ["Anandhu krishnan", "S6 CT", "101"],
      ["Vijaya lakshmi", "S6 CT", "117"],
      ["Aswanth Sasi", "S6 CT", "130"],
      ["Aswin KS", "S6 CT", "131"],
      ["Asna Ruquiya", "S6 CT", "132"],
      ["Sandhra Shijo", "S6 CT", "133"],
      ["Anandhu krishnan V S", "S6 CT", "134"],
      ["Amal saji", "S6 CT", "135"],
      ["Arjun S.S", "S6 CT", "127"],
      ["Archana Binu", "S6 CHE", "123"],
      ["Ajin Shaji", "S6 CHE", "124"],
      ["Abhijith B S", "S4 CT", "103"],
      ["Abhijith Prakash", "S4 CT", "104"],
      ["Dania Sojan", "S4 CT", "105"],
      ["Sangeeth omanakkuttan", "S4 CT", "106"],
      ["Vishnu Bhaskar", "S4 CT", "107"],
      ["Ajins Sabu", "S4 CT", "108"],
      ["Ann Mary Tom", "S4 CT", "109"],
      ["Akhil omanakkuttan", "S4 CT", "110"],
      ["Alan Shiju", "S4 CT", "111"],
      ["sidharth", "S4 CT", "113"],
      ["Joseph E J", "S4 CT", "115"],
      ["Bijil Biju", "S4 CT", "119"],
      ["Siya Binoy", "S4 CT", "120"],
      ["NavaneethKrishna Manoj", "S4 CT", "121"],
      ["Sarath K S", "S4 CT", "125"],
      ["Akash Shaji", "S4 CT", "128"],
      ["Sooraj Sreekanth", "S4 CT", "129"],
      ["Midhun Manoj", "S4 CT", "122"],
      ["Thejas", "S4 EL", "126"],
      ["Christeena Mol S", "S4 EL", "116"],
    ],
  },
  {
    sheet: "Story Writing — TAMIL",
    item: "Story Writing(Tamil)",
    category: "OFF_STAGE",
    people: [
      ["Karthikeyan", "S2 CHE", "101"],
      ["Sharavanan", "S4 CT", "102"],
      ["Arun Kumar A", "S4 CT", "103"],
      ["Praveena", "S2 CT", "104"],
    ],
  },
  {
    sheet: "Story Writing — ENGLISH",
    item: "Story Writing(English)",
    category: "OFF_STAGE",
    people: [["Anandhu krishnan", "S6 CT", "101"]],
  },
  {
    sheet: "Pencil Drawing (05-02-2026 1 PM to 3 PM)",
    item: "Pencil Drawing",
    category: "OFF_STAGE",
    people: [
      ["Anandhu krishnan", "S6 CT", "101"],
      ["Adhithyan M", "S6 CT", "102"],
      ["Muhammad Thahir", "S6 CT", "122"],
      ["Aswin KS", "S6 CT", "149"],
      ["Devananth KS", "S6 CT", "150"],
      ["Amjith soy", "S6 CT", "151"],
      ["Albin Siby", "S6 CT", "152"],
      ["Amose Rajeev", "S6 CT", "153"],
      ["Pranav Prakash", "S6 CT", "154"],
      ["Arjun S.S", "S6 CT", "120"],
      ["Abhiraj S", "S6 CT", "155"],
      ["Abhijith B S", "S4 CT", "103"],
      ["Akash Shaji", "S4 CT", "104"],
      ["Aldrin P Shiju", "S4 CT", "109"],
      ["Ajay", "S4 CT", "110"],
      ["sidharth", "S4 CT", "111"],
      ["Bijil Biju", "S4 CT", "115"],
      ["Ann Mary Tom", "S4 CT", "116"],
      ["Siya Binoy", "S4 CT", "117"],
      ["Bimal Viju", "S4 CT", "121"],
      ["Andas B S", "S4 CT", "125"],
      ["Ayoob Biju", "S4 CT", "126"],
      ["Anandhu Biju", "S4 CT", "127"],
      ["Anjai Suresh", "S4 CT", "128"],
      ["Aleena Johnson T J", "S4 CT", "146"],
      ["Dania Sojan", "S4 CT", "148"],
      ["Akhil omanakkuttan", "S4 CT", "161"],
      ["Abhiram. ps", "S4 EL", "118"],
      ["Akash K.M", "S4 EL", "119"],
      ["Aromal", "S4 EL", "142"],
      ["Midhun", "S4 EL", "143"],
      ["Thejus", "S4 EL", "144"],
      ["Christina", "S4 EL", "145"],
      ["Milha", "S2 CT", "112"],
      ["Jaidhev P.A", "S2 CT", "123"],
      ["Kasyap C.B", "S2 CT", "124"],
      ["Vipin M Vinod", "S2 CT", "129"],
      ["Alen Saji", "S2 CT", "130"],
      ["Nikhi Jaimon", "S2 CT", "131"],
      ["Jonit Biju", "S2 CT", "132"],
      ["Eby Joy", "S2 CT", "133"],
      ["Jerimiah Joshy", "S2 CT", "134"],
      ["Joshua Johns", "S2 CT", "135"],
      ["Anandhu Harikkuttan", "S2 CT", "136"],
      ["Adil Shahul", "S2 CT", "137"],
      ["Jishnu Vinesh", "S2 CT", "138"],
      ["Abinav C Rajesh", "S2 CT", "147"],
      ["Sachin VA", "S2 CT", "159"],
      ["Srijith", "S2 CT", "160"],
      ["Praveen Raja", "S2 CHE", "105"],
      ["Adhithyan Biju", "S2 CHE", "106"],
      ["Bijo", "S2 CHE", "107"],
      ["Deo", "S2 CHE", "108"],
      ["Vignesh", "S2 CHE", "139"],
      ["Jith Saji", "S2 CHE", "140"],
      ["Sarath Prasath", "S2 CHE", "141"],
      ["Siju Mon", "S2 CHE", "156"],
      ["Dharun", "S2 CHE", "157"],
      ["Dhanooj Justin", "S2 EL", "113"],
      ["Vaisakh E.T", "S2 EL", "114"],
    ],
  },
];

const ON_STAGE: Sheet[] = [
  {
    sheet: "NADANPATTU",
    item: "Nadanpattu",
    category: "ON_STAGE",
    itemType: "GROUP",
    people: [
      ["Sarithamol K J", "S4CHE", "101"],
      ["Abhishek", "S4CT", "101"],
      ["Ayoob Biju", "S4CT", "101"],
      ["Abhiram", "S4EL", "101"],
      ["Sandra S", "S4CT", "101"],
      ["Christeenamol", "S4EL", "101"],
      ["Abhinav", "S2CT", "101"],
    ],
  },
  {
    sheet: "FILM SONG",
    item: "Film Song",
    category: "ON_STAGE",
    itemType: "SINGLE",
    people: [
      ["Aksa Mol Shaji", "S2 CT", "150"],
      ["Anjana M.Unni", "S6 CT", "151"],
      ["Navami Sunil", "S4 CT", "152"],
      ["Arjun", "S6 CT", "153"],
    ],
  },
  {
    sheet: "THIRUVATHIRA",
    item: "Thiruvathira",
    category: "ON_STAGE",
    itemType: "GROUP",
    people: [
      ["Sarithamol KJ", "S4CHE", "125"],
      ["Archana Rajeshkumar", "S4CHE", "125"],
      ["Bijil Biju", "S4CT", "125"],
      ["Sandra S", "S4CT", "125"],
      ["Ashlymol Jhonson", "S6CT", "125"],
      ["Anjana M Unni", "S6CT", "125"],
      ["Amrutha S", "S6CT", "125"],
      ["Jobina C J", "S6CT", "125"],
      ["Alfina K", "S6CT", "125"],
      ["Della Anna Varghese", "S6CT", "125"],
    ],
  },
  {
    sheet: "KEY BOARD",
    item: "Key Board",
    category: "ON_STAGE",
    itemType: "SINGLE",
    people: [["Sooraj Sreekanth", "S4CT", "101"]],
  },
  {
    sheet: "MAPILAPATTU",
    item: "Mapilapattu",
    category: "ON_STAGE",
    itemType: "SINGLE",
    people: [["Muhammed Thahir", "S6CT", "101"]],
  },
  {
    sheet: "PATRIOTIC SONG",
    item: "Patriotic Song",
    category: "ON_STAGE",
    itemType: "GROUP",
    people: [
      ["Anjana M.Unni", "S6CT", "101"],
      ["Asna Ruqiya", "S6CT", "101"],
      ["Athira Unni.R", "S6CT", "101"],
      ["Ashly Mol Johnson", "S6CT", "101"],
      ["Amrutha.S", "S6CT", "101"],
      ["Archana Binu", "S6CT", "101"],
      ["Swaliha Basheer", "S6CT", "101"],
    ],
  },
  {
    sheet: "MIME",
    item: "Mime",
    category: "ON_STAGE",
    itemType: "GROUP",
    people: [
      ["Vaisak.E.T", "S6 EL", "130"],
      ["Rahul.Reji", "S6 EL", "130"],
      ["Sarath K.S", "S6 EL", "130"],
      ["Soorj Jiji", "S6 EL", "130"],
      ["Amal K.S", "S6 EL", "130"],
      ["Adithyan Santhosh", "S6 EL", "130"],
      ["Vidhul Krishna", "S6 EL", "130"],
    ],
  },
  {
    sheet: "GROUP SONG",
    item: "Group Song",
    category: "ON_STAGE",
    itemType: "GROUP",
    people: [
      ["Amjith Soy", "S6 CT", "130"],
      ["Albin Siby", "S6 CT", "130"],
      ["Amose Rajeev", "S6 CT", "130"],
      ["Abhiraj S", "S6 CT", "130"],
      ["Devananth K S", "S6 CT", "130"],
      ["Pranav Prakash", "S6 CT", "130"],
      ["Aswin K S", "S6 CT", "130"],
      ["Nandhu M P", "S6 CT", "130"],
    ],
  },
  {
    sheet: "GROUP DANCE",
    item: "Group Dance",
    category: "ON_STAGE",
    itemType: "GROUP",
    people: [
      ["Malavika S", "S4 CT", "130"],
      ["Akshaya Aji", "S4 CT", "130"],
      ["Navami Sunil", "S4 CT", "130"],
      ["Annmary Tom", "S4 CT", "130"],
      ["Martha Nayak", "S4 CT", "130"],
      ["Vidhul", "S6EL", "131"],
      ["Princy", "S4EL", "131"],
    ],
  },
];

async function main() {
  const eventId = Number(process.argv[2] ?? 6);

  const [event] = await sql`SELECT id, name FROM event_t WHERE id = ${eventId} AND display = 'Y'`;
  if (!event) {
    console.error(`✖ Event ${eventId} not found.`);
    await sql.end();
    process.exit(1);
  }
  console.log(`Seeding registrations into event ${event.id} — ${event.name}\n`);

  const [{ max }] = await sql`
    SELECT COALESCE(MAX(sort_order), 0) AS max FROM event_item_t
    WHERE event_id = ${eventId} AND display = 'Y'
  `;
  let order = Number(max);

  const createdItems: string[] = [];
  let added = 0;
  let skipped = 0;
  const report: { item: string; sheet: string; added: number; skipped: number }[] = [];

  for (const s of [...OFF_STAGE, ...ON_STAGE]) {
    // Find the item, or create it (on-stage items and SA Writing are new).
    let [item] = await sql`
      SELECT id FROM event_item_t
      WHERE event_id = ${eventId} AND display = 'Y' AND lower(name) = lower(${s.item})
      LIMIT 1
    `;
    if (!item) {
      order++;
      [item] = await sql`
        INSERT INTO event_item_t
          (event_id, name, category, item_type, scheduled_date, scheduled_time, sort_order, display)
        VALUES
          (${eventId}, ${s.item}, ${s.category}, ${s.itemType ?? "SINGLE"},
           ${s.date ?? null}, ${s.time ?? null}, ${order}, 'Y')
        RETURNING id
      `;
      createdItems.push(`${s.item} (${s.category.replace("_", " ").toLowerCase()})`);
    } else if (s.itemType === "GROUP") {
      // The registration sheet tells us it is a group entry; the duty list did not.
      await sql`UPDATE event_item_t SET item_type = 'GROUP' WHERE id = ${item.id}`;
    }

    let a = 0;
    let k = 0;
    for (const [name, cls, chest] of s.people) {
      const dup = await sql`
        SELECT id FROM event_participant_t
        WHERE item_id = ${item.id} AND display = 'Y'
          AND lower(participant_name) = lower(${name})
          AND coalesce(chest_no, '') = ${chest}
        LIMIT 1
      `;
      if (dup.length > 0) {
        k++;
        continue;
      }
      await sql`
        INSERT INTO event_participant_t
          (item_id, chest_no, participant_name, class_name, sort_order, display)
        VALUES (${item.id}, ${chest}, ${name}, ${cls}, ${a + 1}, 'Y')
      `;
      a++;
    }
    added += a;
    skipped += k;
    report.push({ item: s.item, sheet: s.sheet, added: a, skipped: k });
    console.log(`✔ ${s.item.padEnd(30)} ${String(a).padStart(3)} added${k ? `, ${k} already there` : ""}`);
  }

  console.log(`\n✔ ${added} participants added, ${skipped} already present.`);
  if (createdItems.length) {
    console.log(`\nItems created:\n  ${createdItems.join("\n  ")}`);
  }

  // Duplicate chest numbers within an item are worth knowing about — they are
  // in the source sheets, not introduced here.
  const dups = await sql`
    SELECT i.name AS item, p.chest_no, count(*)::int AS n,
           string_agg(p.participant_name, ', ' ORDER BY p.participant_name) AS who
    FROM event_participant_t p
    JOIN event_item_t i ON i.id = p.item_id
    WHERE i.event_id = ${eventId} AND i.display = 'Y' AND p.display = 'Y'
      AND i.item_type <> 'GROUP' AND p.chest_no IS NOT NULL
    GROUP BY i.name, p.chest_no
    HAVING count(*) > 1
    ORDER BY i.name, p.chest_no
  `;
  if (dups.length) {
    console.log(`\n⚠ Duplicate chest numbers in the source sheets (individual items only):`);
    for (const d of dups) console.log(`  ${d.item} — chest ${d.chest_no} × ${d.n}: ${d.who}`);
  }

  const totals = await sql`
    SELECT i.category, count(DISTINCT i.id)::int AS items, count(p.id)::int AS participants
    FROM event_item_t i
    LEFT JOIN event_participant_t p ON p.item_id = i.id AND p.display = 'Y'
    WHERE i.event_id = ${eventId} AND i.display = 'Y'
    GROUP BY i.category ORDER BY i.category
  `;
  console.log(`\nEvent totals:`);
  console.table(totals.map((t) => ({ category: t.category, items: t.items, participants: t.participants })));

  await sql.end();
}

main().catch(async (e) => {
  console.error("✖ Failed:", e.message);
  await sql.end();
  process.exit(1);
});
