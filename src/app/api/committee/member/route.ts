import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { getSession } from "@/lib/session";
import { committeeMemberT, committeeT, staffT } from "@/db/schema";
import { toMemberRole } from "@/lib/committee";

// Members named in a committee's appointment order.

type Body = {
  id?: number;
  committee_id?: number;
  staff_id?: string | number | null;
  member_name?: string;
  designation?: string;
  member_role?: string;
  sort_order?: number | string;
};

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "") || null;
const numOrNull = (v: unknown) => {
  const n = Number(v);
  return v === "" || v === undefined || v === null || Number.isNaN(n) ? null : n;
};
const int0 = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};

/**
 * Resolve the member's name and designation.
 *
 * When a staff member is picked we copy their name and designation from the
 * staff register, so the printed order and the register cannot disagree — but
 * a typed designation still wins, because a member's role on the committee is
 * often not their job title.
 */
async function resolveMember(body: Body) {
  const staff_id = numOrNull(body.staff_id);
  let member_name = String(body.member_name ?? "").trim();
  let designation = str(body.designation);

  // Whether the caller stated a designation at all. The form always sends the
  // field, so an empty one means "none" — falling back to the staff register
  // there would make the dialog's "— None —" option impossible to apply.
  const designationGiven = Object.prototype.hasOwnProperty.call(body, "designation");

  if (staff_id) {
    const [staff] = await db
      .select({ staff_name: staffT.staff_name, designation: staffT.designation })
      .from(staffT)
      .where(eq(staffT.id, staff_id));
    if (staff) {
      member_name = staff.staff_name;
      if (!designationGiven) designation = staff.designation ?? null;
    }
  }

  return {
    staff_id,
    member_name,
    designation,
    member_role: toMemberRole(body.member_role),
    sort_order: int0(body.sort_order),
  };
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as Body;
  const committeeId = Number(body.committee_id);
  if (!committeeId) {
    return NextResponse.json({ success: false, message: "Committee id is required" }, { status: 400 });
  }

  const [committee] = await db
    .select({ id: committeeT.id })
    .from(committeeT)
    .where(eq(committeeT.id, committeeId));
  if (!committee) {
    return NextResponse.json({ success: false, message: "Committee not found" }, { status: 404 });
  }

  const v = await resolveMember(body);
  if (!v.member_name) {
    return NextResponse.json(
      { success: false, message: "Pick a staff member, or type a name" },
      { status: 400 }
    );
  }

  try {
    const [row] = await db
      .insert(committeeMemberT)
      .values({ ...v, committee_id: committeeId, display: "Y" })
      .returning({ id: committeeMemberT.id });
    return NextResponse.json({ success: true, message: "Member added", id: row.id });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as Body;
  const id = Number(body.id);
  if (!id) return NextResponse.json({ success: false, message: "Member id is required" }, { status: 400 });

  const v = await resolveMember(body);
  if (!v.member_name) {
    return NextResponse.json(
      { success: false, message: "Pick a staff member, or type a name" },
      { status: 400 }
    );
  }

  try {
    await db.update(committeeMemberT).set(v).where(eq(committeeMemberT.id, id));
    return NextResponse.json({ success: true, message: "Member updated", id });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ success: false, message: "Member id is required" }, { status: 400 });

  try {
    // Soft delete, matching the masters — the order's history is preserved.
    await db.update(committeeMemberT).set({ display: "N" }).where(eq(committeeMemberT.id, id));
    return NextResponse.json({ success: true, message: "Member removed" });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}
