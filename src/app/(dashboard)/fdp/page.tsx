import Link from "next/link";
import { and, desc, eq, sql } from "drizzle-orm";
import { Plus } from "lucide-react";
import { db } from "@/db";
import {
  attachmentT,
  departmentMasterT,
  fdpT,
  staffT,
  subjectMasterT,
} from "@/db/schema";
import { buttonClasses } from "@/components/ui/button";
import FdpList from "./fdp-list";

// Faculty Development Programmes attended by staff.
export default async function FdpPage() {
  const rows = await db
    .select({
      id: fdpT.id,
      title: fdpT.title,
      faculty_name: fdpT.faculty_name,
      staff_name: staffT.staff_name,
      organizer: fdpT.organizer,
      mode: fdpT.mode,
      start_date: fdpT.start_date,
      end_date: fdpT.end_date,
      academic_year: fdpT.academic_year,
      topics: fdpT.topics,
      subject_name: subjectMasterT.subject_name,
      department_name: departmentMasterT.department_name,
      file_count: sql<number>`count(${attachmentT.id})::int`,
      // Surfaced on the card so a missing certificate is obvious at a glance.
      has_certificate: sql<boolean>`coalesce(bool_or(${attachmentT.category} = 'CERTIFICATE'), false)`,
    })
    .from(fdpT)
    .leftJoin(staffT, eq(fdpT.staff_id, staffT.id))
    .leftJoin(subjectMasterT, eq(fdpT.subject_id, subjectMasterT.id))
    .leftJoin(departmentMasterT, eq(fdpT.department_id, departmentMasterT.id))
    .leftJoin(
      attachmentT,
      and(
        eq(attachmentT.owner_type, "FDP"),
        eq(attachmentT.owner_id, fdpT.id),
        eq(attachmentT.display, "Y")
      )
    )
    .where(eq(fdpT.display, "Y"))
    .groupBy(fdpT.id, staffT.staff_name, subjectMasterT.subject_name, departmentMasterT.department_name)
    .orderBy(desc(fdpT.start_date), desc(fdpT.id));

  return (
    <FdpList
      rows={rows}
      actions={
        <Link href="/fdp/new" className={buttonClasses({ size: "sm" })}>
          <Plus className="h-4 w-4" /> New
        </Link>
      }
    />
  );
}
