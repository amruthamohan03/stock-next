import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  timetableT,
  timetablePeriodT,
  timetableSlotT,
  departmentMasterT,
  subjectMasterT,
  staffT,
} from "@/db/schema";
import { Card, CardContent } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { ArrowLeft, Pencil } from "lucide-react";
import PrintButton from "../../report/_components/print-button";

const DAYS = [
  { key: "MON", label: "Monday" },
  { key: "TUE", label: "Tuesday" },
  { key: "WED", label: "Wednesday" },
  { key: "THU", label: "Thursday" },
  { key: "FRI", label: "Friday" },
];

export default async function TimetableViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ttId = Number(id);
  if (!Number.isInteger(ttId) || ttId <= 0) notFound();

  const [header] = await db
    .select({
      id: timetableT.id,
      title: timetableT.title,
      semester: timetableT.semester,
      scheme: timetableT.scheme,
      academic_year: timetableT.academic_year,
      department_name: departmentMasterT.department_name,
    })
    .from(timetableT)
    .leftJoin(departmentMasterT, eq(departmentMasterT.id, timetableT.department_id))
    .where(and(eq(timetableT.id, ttId), eq(timetableT.display, "Y")))
    .limit(1);
  if (!header) notFound();

  const [periods, slots] = await Promise.all([
    db
      .select()
      .from(timetablePeriodT)
      .where(eq(timetablePeriodT.timetable_id, ttId))
      .orderBy(asc(timetablePeriodT.period_no)),
    db
      .select({
        day: timetableSlotT.day,
        period_no: timetableSlotT.period_no,
        batch: timetableSlotT.batch,
        subject_name: subjectMasterT.subject_name,
        subject_code: subjectMasterT.subject_code,
        staff_name: staffT.staff_name,
      })
      .from(timetableSlotT)
      .leftJoin(subjectMasterT, eq(subjectMasterT.id, timetableSlotT.subject_id))
      .leftJoin(staffT, eq(staffT.id, timetableSlotT.staff_id))
      .where(and(eq(timetableSlotT.timetable_id, ttId), eq(timetableSlotT.display, "Y"))),
  ]);

  // slotMap[`${day}:${period_no}`] = slot
  const slotMap = new Map<string, (typeof slots)[number]>();
  for (const s of slots) slotMap.set(`${s.day}:${s.period_no}`, s);

  const meta = [
    header.semester,
    header.scheme,
    header.academic_year ? `A.Y. ${header.academic_year}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-fg">{header.title}</h1>
        <div className="flex gap-2">
          <Link href="/timetable" className={buttonClasses({ variant: "outline", size: "sm" })}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <Link href={`/timetable/${header.id}/edit`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
            <Pencil className="h-4 w-4" /> Edit
          </Link>
          <PrintButton />
        </div>
      </div>

      <Card className="p-5">
        <div className="printable">
          <div className="mb-4 text-center">
            <div className="text-base font-bold text-fg">{header.department_name || "Timetable"}</div>
            <div className="text-sm font-semibold text-muted">{header.title}</div>
            {meta && <div className="text-xs text-faint">{meta}</div>}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs" style={{ minWidth: `${12 + periods.length * 9}rem` }}>
              <thead>
                <tr className="bg-elevated text-left text-[11px] text-muted">
                  <th className="border border-line px-2 py-2 font-semibold">Day \ Period</th>
                  {periods.map((p, i) => (
                    <th
                      key={i}
                      className={`border border-line px-2 py-2 text-center font-semibold ${p.is_break ? "bg-amber-500/10" : ""}`}
                    >
                      <div>{p.is_break ? p.label || "Break" : `P${p.label}`}</div>
                      <div className="font-normal text-faint">
                        {[p.start_time, p.end_time].filter(Boolean).join("–")}
                      </div>
                      {p.is_break && (p.fri_start_time || p.fri_end_time) && (
                        <div className="text-[9px] font-normal normal-case text-amber-600">
                          Fri {[p.fri_start_time, p.fri_end_time].filter(Boolean).join("–")}
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((d) => (
                  <tr key={d.key} className="align-top">
                    <td className="border border-line bg-elevated px-2 py-2 font-semibold text-fg">{d.label}</td>
                    {periods.map((p, idx) => {
                      if (p.is_break) {
                        const friT =
                          d.key === "FRI" && (p.fri_start_time || p.fri_end_time)
                            ? [p.fri_start_time, p.fri_end_time].filter(Boolean).join("–")
                            : null;
                        return (
                          <td key={idx} className="border border-line bg-amber-500/5 text-center align-middle text-[10px] font-semibold uppercase tracking-wide text-amber-600">
                            Break
                            {friT && <div className="text-[9px] font-normal normal-case text-amber-700">{friT}</div>}
                          </td>
                        );
                      }
                      const s = slotMap.get(`${d.key}:${idx}`);
                      return (
                        <td key={idx} className="border border-line px-2 py-2 text-center">
                          {s ? (
                            <>
                              <div className="font-semibold text-fg">
                                {s.subject_code || s.subject_name || "—"}
                              </div>
                              {s.subject_code && s.subject_name && (
                                <div className="text-[10px] text-muted">{s.subject_name}</div>
                              )}
                              {s.staff_name && <div className="text-[10px] text-accent">{s.staff_name}</div>}
                              {s.batch && <div className="text-[10px] text-faint">{s.batch}</div>}
                            </>
                          ) : (
                            <span className="text-faint">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
}
