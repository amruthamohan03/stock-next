import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { timetableT, timetablePeriodT, timetableSlotT } from "@/db/schema";
import { getTimetableOptions } from "../../options";
import TimetableBuilder, { type TimetableInitial } from "../../timetable-builder";

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export default async function EditTimetablePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ttId = Number(id);
  if (!Number.isInteger(ttId) || ttId <= 0) notFound();

  const [options, headerRows] = await Promise.all([
    getTimetableOptions(),
    db
      .select()
      .from(timetableT)
      .where(and(eq(timetableT.id, ttId), eq(timetableT.display, "Y")))
      .limit(1),
  ]);

  const h = headerRows[0];
  if (!h) notFound();

  const [periods, slots] = await Promise.all([
    db
      .select()
      .from(timetablePeriodT)
      .where(eq(timetablePeriodT.timetable_id, ttId))
      .orderBy(asc(timetablePeriodT.period_no)),
    db
      .select()
      .from(timetableSlotT)
      .where(and(eq(timetableSlotT.timetable_id, ttId), eq(timetableSlotT.display, "Y"))),
  ]);

  const initial: TimetableInitial = {
    id: h.id,
    title: s(h.title),
    department_id: s(h.department_id),
    semester: s(h.semester),
    scheme: s(h.scheme),
    academic_year: s(h.academic_year),
    periods: periods.map((p) => ({
      label: s(p.label),
      start_time: s(p.start_time),
      end_time: s(p.end_time),
      fri_start_time: s(p.fri_start_time),
      fri_end_time: s(p.fri_end_time),
      is_break: p.is_break === 1,
    })),
    slots: slots.map((sl) => ({
      day: s(sl.day),
      period_no: sl.period_no,
      subject_id: s(sl.subject_id),
      staff_id: s(sl.staff_id),
      batch: s(sl.batch),
    })),
  };

  return <TimetableBuilder {...options} initial={initial} />;
}
