import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { getSession } from "@/lib/session";
import { timetableT, timetablePeriodT, timetableSlotT } from "@/db/schema";

type PeriodPayload = {
  label?: string;
  start_time?: string;
  end_time?: string;
  fri_start_time?: string;
  fri_end_time?: string;
  is_break?: boolean;
};
type SlotPayload = {
  day?: string;
  period_no?: number;
  subject_id?: string | number | null;
  staff_id?: string | number | null;
  batch?: string;
};
type Body = {
  id?: number;
  title?: string;
  department_id?: string | number | null;
  semester?: string;
  scheme?: string;
  academic_year?: string;
  periods?: PeriodPayload[];
  slots?: SlotPayload[];
};

const DAYS = new Set(["MON", "TUE", "WED", "THU", "FRI", "SAT"]);
const numOrNull = (v: unknown) => {
  const n = Number(v);
  return v === "" || v === undefined || v === null || Number.isNaN(n) ? null : n;
};
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "") || null;

function periodRows(id: number, periods: PeriodPayload[]) {
  return periods.map((p, i) => ({
    timetable_id: id,
    period_no: i,
    label: str(p.label),
    start_time: str(p.start_time),
    end_time: str(p.end_time),
    fri_start_time: str(p.fri_start_time),
    fri_end_time: str(p.fri_end_time),
    is_break: p.is_break ? 1 : 0,
  }));
}

/** Keep only slots that reference a real teaching period and have a subject. */
function slotRows(id: number, slots: SlotPayload[], breakPeriods: Set<number>) {
  return slots
    .filter(
      (s) =>
        s.day &&
        DAYS.has(String(s.day)) &&
        Number.isInteger(Number(s.period_no)) &&
        !breakPeriods.has(Number(s.period_no)) &&
        numOrNull(s.subject_id) !== null
    )
    .map((s) => ({
      timetable_id: id,
      day: String(s.day),
      period_no: Number(s.period_no),
      subject_id: numOrNull(s.subject_id),
      staff_id: numOrNull(s.staff_id),
      batch: str(s.batch),
      display: "Y",
    }));
}

function validate(body: Body) {
  const title = String(body.title ?? "").trim();
  if (!title) return { error: "Timetable title is required" };
  const periods = body.periods ?? [];
  if (periods.length === 0) return { error: "Add at least one period" };
  const teaching = periods.filter((p) => !p.is_break).length;
  if (teaching === 0) return { error: "Add at least one non-break period" };
  return { title, periods, slots: body.slots ?? [] };
}

const header = (body: Body, title: string) => ({
  title,
  department_id: numOrNull(body.department_id),
  semester: str(body.semester),
  scheme: str(body.scheme),
  academic_year: str(body.academic_year),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as Body;
  const v = validate(body);
  if ("error" in v) return NextResponse.json({ success: false, message: v.error }, { status: 400 });

  const breakSet = new Set(v.periods.map((p, i) => (p.is_break ? i : -1)).filter((i) => i >= 0));

  try {
    const id = await db.transaction(async (tx) => {
      const [tt] = await tx
        .insert(timetableT)
        .values({ ...header(body, v.title), created_by: session.id, display: "Y" })
        .returning({ id: timetableT.id });
      await tx.insert(timetablePeriodT).values(periodRows(tt.id, v.periods));
      const rows = slotRows(tt.id, v.slots, breakSet);
      if (rows.length) await tx.insert(timetableSlotT).values(rows);
      return tt.id;
    });
    return NextResponse.json({ success: true, message: "Timetable saved", id });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as Body;
  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0)
    return NextResponse.json({ success: false, message: "Invalid timetable id" }, { status: 400 });

  const v = validate(body);
  if ("error" in v) return NextResponse.json({ success: false, message: v.error }, { status: 400 });

  const breakSet = new Set(v.periods.map((p, i) => (p.is_break ? i : -1)).filter((i) => i >= 0));

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(timetableT)
        .set({ ...header(body, v.title), updated_by: session.id, updated_at: new Date() })
        .where(eq(timetableT.id, id));
      await tx.delete(timetablePeriodT).where(eq(timetablePeriodT.timetable_id, id));
      await tx.delete(timetableSlotT).where(eq(timetableSlotT.timetable_id, id));
      await tx.insert(timetablePeriodT).values(periodRows(id, v.periods));
      const rows = slotRows(id, v.slots, breakSet);
      if (rows.length) await tx.insert(timetableSlotT).values(rows);
    });
    return NextResponse.json({ success: true, message: "Timetable updated", id });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0)
    return NextResponse.json({ success: false, message: "Invalid timetable id" }, { status: 400 });

  try {
    await db.update(timetableT).set({ display: "N" }).where(eq(timetableT.id, id));
    return NextResponse.json({ success: true, message: "Timetable deleted" });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}
