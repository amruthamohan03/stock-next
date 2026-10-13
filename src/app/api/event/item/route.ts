import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { getSession } from "@/lib/session";
import { eventDutyT, eventItemT, eventParticipantT } from "@/db/schema";
import { ITEM_CATEGORIES } from "@/lib/event-status";
import { assertEventEditable, eventIdOfItem } from "@/lib/event-guard";

// Competition items within an event. Every write goes through the parent
// event's lock, so a finalised event's programme cannot be rearranged.

type Body = {
  id?: number;
  event_id?: number;
  name?: string;
  category?: string;
  item_type?: string;
  stage?: string;
  venue?: string;
  scheduled_date?: string;
  scheduled_time?: string;
  topic?: string;
  sort_order?: number | string;
};

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "") || null;
const int0 = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};

function values(body: Body) {
  const category = String(body.category ?? "").toUpperCase();
  return {
    name: String(body.name ?? "").trim(),
    category: (ITEM_CATEGORIES as readonly string[]).includes(category) ? category : "ON_STAGE",
    item_type: String(body.item_type ?? "").toUpperCase() === "GROUP" ? "GROUP" : "SINGLE",
    stage: str(body.stage),
    venue: str(body.venue),
    scheduled_date: str(body.scheduled_date),
    scheduled_time: str(body.scheduled_time),
    topic: str(body.topic),
    sort_order: int0(body.sort_order),
  };
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as Body;
  const eventId = Number(body.event_id);
  const v = values(body);
  if (!eventId) return NextResponse.json({ success: false, message: "Event id is required" }, { status: 400 });
  if (!v.name) return NextResponse.json({ success: false, message: "Item name is required" }, { status: 400 });

  const guard = await assertEventEditable(eventId, session.roleId);
  if (guard.error) return guard.error;

  try {
    const [row] = await db
      .insert(eventItemT)
      .values({ ...v, event_id: eventId, display: "Y" })
      .returning({ id: eventItemT.id });
    return NextResponse.json({ success: true, message: "Item added", id: row.id });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as Body;
  const id = Number(body.id);
  const v = values(body);
  if (!id) return NextResponse.json({ success: false, message: "Item id is required" }, { status: 400 });
  if (!v.name) return NextResponse.json({ success: false, message: "Item name is required" }, { status: 400 });

  const eventId = await eventIdOfItem(id);
  if (!eventId) return NextResponse.json({ success: false, message: "Item not found" }, { status: 404 });
  const guard = await assertEventEditable(eventId, session.roleId);
  if (guard.error) return guard.error;

  try {
    await db.update(eventItemT).set(v).where(eq(eventItemT.id, id));
    return NextResponse.json({ success: true, message: "Item updated", id });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ success: false, message: "Item id is required" }, { status: 400 });

  const eventId = await eventIdOfItem(id);
  if (!eventId) return NextResponse.json({ success: false, message: "Item not found" }, { status: 404 });
  const guard = await assertEventEditable(eventId, session.roleId);
  if (guard.error) return guard.error;

  try {
    // Soft delete the item and everything hanging off it, so removing an item
    // does not leave its duty list and participants visible elsewhere.
    await db.transaction(async (tx) => {
      await tx.update(eventItemT).set({ display: "N" }).where(eq(eventItemT.id, id));
      await tx.update(eventDutyT).set({ display: "N" }).where(eq(eventDutyT.item_id, id));
      await tx.update(eventParticipantT).set({ display: "N" }).where(eq(eventParticipantT.item_id, id));
    });
    return NextResponse.json({ success: true, message: "Item deleted" });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}
