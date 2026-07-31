import { NextResponse, type NextRequest } from "next/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { getSession } from "@/lib/session";
import { subjectMasterT, subjectFacultyT, staffT } from "@/db/schema";

// Auto-schedule a DRAFT timetable from a semester's subjects and their mapped
// faculty. Greedy: place each subject's weekly periods (L+T+P) into free cells,
// spreading across days and never double-booking a faculty. The result is
// returned for review in the builder — nothing is saved here.

const DAYS = ["MON", "TUE", "WED", "THU", "FRI"];

// Default period grid (Friday lunch runs 12:50–14:00 per requirement).
const PERIODS = [
  { label: "1", start_time: "09:20", end_time: "10:15", fri_start_time: "", fri_end_time: "", is_break: false },
  { label: "2", start_time: "10:15", end_time: "11:10", fri_start_time: "", fri_end_time: "", is_break: false },
  { label: "3", start_time: "11:20", end_time: "12:15", fri_start_time: "", fri_end_time: "", is_break: false },
  { label: "Lunch", start_time: "12:15", end_time: "13:00", fri_start_time: "12:50", fri_end_time: "14:00", is_break: true },
  { label: "4", start_time: "13:00", end_time: "13:55", fri_start_time: "", fri_end_time: "", is_break: false },
  { label: "5", start_time: "13:55", end_time: "14:50", fri_start_time: "", fri_end_time: "", is_break: false },
  { label: "6", start_time: "14:50", end_time: "15:45", fri_start_time: "", fri_end_time: "", is_break: false },
];

const num = (v: unknown) => Number(v ?? 0);

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { department_id?: number; semester?: string; scheme?: string };
  const deptId = Number(body.department_id);
  const semester = String(body.semester ?? "").trim();
  const scheme = String(body.scheme ?? "").trim();
  if (!deptId || !semester)
    return NextResponse.json({ success: false, message: "Department and semester are required" }, { status: 400 });

  const conds = [
    eq(subjectMasterT.department_id, deptId),
    eq(subjectMasterT.semester, semester),
    eq(subjectMasterT.display, "Y"),
  ];
  if (scheme) conds.push(eq(subjectMasterT.scheme, scheme));

  const subjects = await db
    .select({
      id: subjectMasterT.id,
      name: subjectMasterT.subject_name,
      code: subjectMasterT.subject_code,
      l: subjectMasterT.lecture_hours,
      t: subjectMasterT.tutorial_hours,
      p: subjectMasterT.practical_hours,
    })
    .from(subjectMasterT)
    .where(and(...conds))
    .orderBy(asc(subjectMasterT.subject_code));

  if (subjects.length === 0)
    return NextResponse.json({ success: false, message: "No subjects found for that class" }, { status: 400 });

  // First mapped faculty per subject.
  const ids = subjects.map((s) => s.id);
  const maps = await db
    .select({ subject_id: subjectFacultyT.subject_id, staff_id: subjectFacultyT.staff_id })
    .from(subjectFacultyT)
    .where(inArray(subjectFacultyT.subject_id, ids));
  const facBySubject = new Map<number, number>();
  for (const m of maps) if (!facBySubject.has(Number(m.subject_id))) facBySubject.set(Number(m.subject_id), Number(m.staff_id));

  const teachingIdx = PERIODS.map((p, i) => (p.is_break ? -1 : i)).filter((i) => i >= 0);

  const occupied = new Set<string>(); // `${day}:${idx}`
  const facBusy = new Set<string>(); // `${day}:${idx}:${staff}`
  const daySubject = new Set<string>(); // `${day}:${subjectId}`
  const slots: { day: string; period_no: number; subject_id: string; staff_id: string; batch: string }[] = [];
  const warnings: string[] = [];

  // Heaviest subjects first so they get first pick of the week.
  const work = subjects
    .map((s) => ({ ...s, weekly: num(s.l) + num(s.t) + num(s.p) }))
    .filter((s) => s.weekly > 0)
    .sort((a, b) => b.weekly - a.weekly);

  let dayOffset = 0;
  for (const s of work) {
    const staffId = facBySubject.get(s.id) ?? null;
    let placed = 0;
    for (let n = 0; n < s.weekly; n++) {
      let done = false;
      // pass 0 avoids repeating a subject on the same day; pass 1 relaxes it.
      for (let pass = 0; pass < 2 && !done; pass++) {
        for (let di = 0; di < DAYS.length && !done; di++) {
          const day = DAYS[(di + dayOffset) % DAYS.length];
          if (pass === 0 && daySubject.has(`${day}:${s.id}`)) continue;
          for (const idx of teachingIdx) {
            if (occupied.has(`${day}:${idx}`)) continue;
            if (staffId != null && facBusy.has(`${day}:${idx}:${staffId}`)) continue;
            occupied.add(`${day}:${idx}`);
            if (staffId != null) facBusy.add(`${day}:${idx}:${staffId}`);
            daySubject.add(`${day}:${s.id}`);
            slots.push({
              day,
              period_no: idx,
              subject_id: String(s.id),
              staff_id: staffId != null ? String(staffId) : "",
              batch: "",
            });
            placed++;
            dayOffset++;
            done = true;
            break;
          }
        }
      }
      if (!done) break;
    }
    if (placed < s.weekly)
      warnings.push(`${s.code || s.name}: scheduled ${placed}/${s.weekly} periods (ran out of free slots).`);
    if (staffId == null)
      warnings.push(`${s.code || s.name}: no faculty mapped — assign one in the grid.`);
  }

  return NextResponse.json({ success: true, data: { periods: PERIODS, slots, warnings } });
}
