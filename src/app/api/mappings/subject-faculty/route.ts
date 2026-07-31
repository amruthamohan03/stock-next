import { NextResponse, type NextRequest } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { getSession } from "@/lib/session";
import { staffT, designationMasterT, departmentMasterT, subjectFacultyT } from "@/db/schema";

// Subject ↔ Faculty mapping. "Faculty" = active staff whose designation is a
// TEACHING designation (Lecturer, Demonstrator, Tradesman, Trade Instructor, …).

/** All faculty (teaching staff) — the pool assignable to a subject. */
async function facultyPool() {
  return db
    .select({
      staff_id: staffT.id,
      staff_code: staffT.staff_code,
      staff_name: staffT.staff_name,
      designation: staffT.designation,
      department_name: departmentMasterT.department_name,
    })
    .from(staffT)
    .innerJoin(
      designationMasterT,
      and(
        eq(designationMasterT.designation_name, staffT.designation),
        eq(designationMasterT.staff_type, "TEACHING"),
        eq(designationMasterT.display, "Y")
      )
    )
    .leftJoin(departmentMasterT, eq(departmentMasterT.id, staffT.department_id))
    .where(eq(staffT.display, "Y"))
    .orderBy(asc(staffT.staff_name));
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const subjectId = Number(new URL(req.url).searchParams.get("subject_id"));
  if (!subjectId) return NextResponse.json({ success: false, message: "Invalid subject" }, { status: 400 });

  const [faculty, mapped] = await Promise.all([
    facultyPool(),
    db
      .select({ staff_id: subjectFacultyT.staff_id })
      .from(subjectFacultyT)
      .where(eq(subjectFacultyT.subject_id, subjectId)),
  ]);

  const mappedSet = new Set(mapped.map((m) => Number(m.staff_id)));
  const data = faculty.map((f) => ({ ...f, mapped: mappedSet.has(Number(f.staff_id)) }));

  return NextResponse.json({ success: true, data });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { subject_id?: number; staff_ids?: number[] };
  const subjectId = Number(body.subject_id);
  if (!subjectId) return NextResponse.json({ success: false, message: "Invalid subject" }, { status: 400 });

  // Only keep ids that are genuinely in the faculty pool (guard against tampering).
  const pool = new Set((await facultyPool()).map((f) => Number(f.staff_id)));
  const staffIds = [...new Set((body.staff_ids ?? []).map(Number))].filter((id) => pool.has(id));

  try {
    await db.transaction(async (tx) => {
      await tx.delete(subjectFacultyT).where(eq(subjectFacultyT.subject_id, subjectId));
      if (staffIds.length) {
        await tx.insert(subjectFacultyT).values(
          staffIds.map((sid) => ({ subject_id: subjectId, staff_id: sid, created_by: session.id }))
        );
      }
    });
    return NextResponse.json({
      success: true,
      message: `Saved — ${staffIds.length} faculty mapped to this subject.`,
    });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}
