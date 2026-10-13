import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { getSession } from "@/lib/session";
import { eventItemT, eventParticipantT } from "@/db/schema";
import { averageOf, gradeFor, toScore } from "@/lib/event-status";
import { assertEventEditable, eventIdOfItem, eventIdOfParticipant } from "@/lib/event-guard";

// The participant register and score card for an item — one row per entrant.

type Body = {
  id?: number;
  item_id?: number;
  chest_no?: string;
  participant_name?: string;
  class_name?: string;
  phone?: string;
  parent_name?: string;
  parent_phone?: string;
  judge1_score?: string | number | null;
  judge2_score?: string | number | null;
  judge3_score?: string | number | null;
  remarks?: string;
};

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "") || null;
/** Store a score as a numeric string, or null when the judge left it blank. */
const score = (v: unknown) => {
  const n = toScore(v);
  return n === null ? null : String(n);
};

function values(body: Body) {
  const j1 = toScore(body.judge1_score);
  const j2 = toScore(body.judge2_score);
  const j3 = toScore(body.judge3_score);
  // The average and grade are derived here as scores are typed, so the score
  // card reads correctly before the event is finalised. Finalising recomputes
  // them anyway, which is what fixes the placings.
  const average = averageOf([j1, j2, j3]);
  return {
    chest_no: str(body.chest_no),
    participant_name: String(body.participant_name ?? "").trim(),
    class_name: str(body.class_name),
    phone: str(body.phone),
    parent_name: str(body.parent_name),
    parent_phone: str(body.parent_phone),
    judge1_score: score(body.judge1_score),
    judge2_score: score(body.judge2_score),
    judge3_score: score(body.judge3_score),
    average_score: average === null ? null : String(average),
    grade: gradeFor(average),
    remarks: str(body.remarks),
  };
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as Body;
  const itemId = Number(body.item_id);
  const v = values(body);
  if (!itemId) return NextResponse.json({ success: false, message: "Item id is required" }, { status: 400 });
  if (!v.participant_name) {
    return NextResponse.json({ success: false, message: "Participant name is required" }, { status: 400 });
  }

  const eventId = await eventIdOfItem(itemId);
  if (!eventId) return NextResponse.json({ success: false, message: "Item not found" }, { status: 404 });
  const guard = await assertEventEditable(eventId, session.roleId);
  if (guard.error) return guard.error;

  try {
    const [row] = await db
      .insert(eventParticipantT)
      .values({ ...v, item_id: itemId, display: "Y" })
      .returning({ id: eventParticipantT.id });
    return NextResponse.json({ success: true, message: "Participant added", id: row.id });
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
  if (!id) return NextResponse.json({ success: false, message: "Participant id is required" }, { status: 400 });
  if (!v.participant_name) {
    return NextResponse.json({ success: false, message: "Participant name is required" }, { status: 400 });
  }

  const eventId = await eventIdOfParticipant(id);
  if (!eventId) return NextResponse.json({ success: false, message: "Participant not found" }, { status: 404 });
  const guard = await assertEventEditable(eventId, session.roleId);
  if (guard.error) return guard.error;

  try {
    await db.update(eventParticipantT).set(v).where(eq(eventParticipantT.id, id));
    return NextResponse.json({ success: true, message: "Participant updated", id });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ success: false, message: "Participant id is required" }, { status: 400 });

  const eventId = await eventIdOfParticipant(id);
  if (!eventId) return NextResponse.json({ success: false, message: "Participant not found" }, { status: 404 });
  const guard = await assertEventEditable(eventId, session.roleId);
  if (guard.error) return guard.error;

  try {
    await db.update(eventParticipantT).set({ display: "N" }).where(eq(eventParticipantT.id, id));
    return NextResponse.json({ success: true, message: "Participant removed" });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}
