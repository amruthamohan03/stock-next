import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Plus } from "lucide-react";
import { db } from "@/db";
import { timetableT, departmentMasterT } from "@/db/schema";
import { buttonClasses } from "@/components/ui/button";
import TimetableList from "./timetable-list";

export default async function TimetablePage() {
  const rows = await db
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
    .where(eq(timetableT.display, "Y"))
    .orderBy(desc(timetableT.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Link href="/timetable/new" className={buttonClasses({ size: "sm" })}>
          <Plus className="h-4 w-4" /> New Timetable
        </Link>
      </div>
      <TimetableList rows={rows} />
    </div>
  );
}
