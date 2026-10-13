import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { fdpT } from "@/db/schema";
import { getFdpOptions } from "@/lib/fdp-queries";
import FdpForm, { type FdpInitial } from "../../fdp-form";

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export default async function EditFdpPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fdpId = Number(id);
  if (!Number.isInteger(fdpId) || fdpId <= 0) notFound();

  const [options, rows] = await Promise.all([
    getFdpOptions(),
    db.select().from(fdpT).where(and(eq(fdpT.id, fdpId), eq(fdpT.display, "Y"))).limit(1),
  ]);

  const r = rows[0];
  if (!r) notFound();

  const initial: FdpInitial = {
    id: r.id,
    title: s(r.title),
    staff_id: s(r.staff_id),
    faculty_name: s(r.faculty_name),
    organizer: s(r.organizer),
    collaborator: s(r.collaborator),
    mode: r.mode ?? "ONLINE",
    venue: s(r.venue),
    start_date: s(r.start_date),
    end_date: s(r.end_date),
    academic_year: s(r.academic_year),
    subject_id: s(r.subject_id),
    department_id: s(r.department_id),
    topics: s(r.topics),
    remarks: s(r.remarks),
  };

  return (
    <FdpForm
      staff={options.staff}
      subjects={options.subjects}
      departments={options.departments}
      initial={initial}
    />
  );
}
