import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { getSession } from "@/lib/session";
import { eventDutyT, eventItemT, staffT } from "@/db/schema";
import { DUTY_ROLES } from "@/lib/event-status";
import { assertEventEditable, eventIdOfItem } from "@/lib/event-guard";

// Duty allocation — the coordinators and judges printed on the duty list.

type Body = {
  id?: number;
  item_id?: number;
  staff_id?: string | number | null;
  person_name?: string;
  duty_role?: string;
};

const numOrNull = (v: unknown) => {
  const n = Number(v);
  return v === "" || v === undefined || v === null || Number.isNaN(n) ? null : n;
};

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as Body;
  const itemId = Number(body.item_id);
  if (!itemId) return NextResponse.json({ success: false, message: "Item id is required" }, { status: 400 });

  const role = String(body.duty_role ?? "").toUpperCase();
  const duty_role = (DUTY_ROLES as readonly string[]).includes(role) ? role : "JUDGE";
  const staff_id = numOrNull(body.staff_id);

  // Prefer the staff register's spelling, so the duty list and the staff master
  // cannot disagree; fall back to a typed name for outside judges.
  let person_name = String(body.person_name ?? "").trim();
  if (staff_id) {
    const [staff] = await db
      .select({ staff_name: staffT.staff_name })
      .from(staffT)
      .where(eq(staffT.id, staff_id));
    if (staff?.staff_name) person_name = staff.staff_name;
  }
  if (!person_name) {
    return NextResponse.json({ success: false, message: "Pick a staff member or type a name" }, { status: 400 });
  }

  const eventId = await eventIdOfItem(itemId);
  if (!eventId) return NextResponse.json({ success: false, message: "Item not found" }, { status: 404 });
  const guard = await assertEventEditable(eventId, session.roleId);
  if (guard.error) return guard.error;

  try {
    const [row] = await db
      .insert(eventDutyT)
      .values({ item_id: itemId, staff_id, person_name, duty_role, display: "Y" })
      .returning({ id: eventDutyT.id });
    return NextResponse.json({ success: true, message: "Duty assigned", id: row.id });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ success: false, message: "Duty id is required" }, { status: 400 });

  const [duty] = await db
    .select({ item_id: eventDutyT.item_id })
    .from(eventDutyT)
    .where(eq(eventDutyT.id, id));
  if (!duty) return NextResponse.json({ success: false, message: "Duty not found" }, { status: 404 });

  const eventId = await eventIdOfItem(duty.item_id);
  if (!eventId) return NextResponse.json({ success: false, message: "Item not found" }, { status: 404 });
  const guard = await assertEventEditable(eventId, session.roleId);
  if (guard.error) return guard.error;

  try {
    await db.update(eventDutyT).set({ display: "N" }).where(eq(eventDutyT.id, id));
    return NextResponse.json({ success: true, message: "Duty removed" });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}
