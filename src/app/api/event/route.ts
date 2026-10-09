import { NextResponse, type NextRequest } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { getSession } from "@/lib/session";
import { eventItemT, eventParticipantT, eventT } from "@/db/schema";
import { assertEventEditable } from "@/lib/event-guard";
import {
  averageOf,
  canEditEvent,
  computePlaces,
  eventTransitionError,
  gradeFor,
  isEventStatus,
  toEventStatus,
  toScore,
} from "@/lib/event-status";

// Events (arts festivals) — save / update / soft-delete, plus finalise & reopen.

type Body = {
  id?: number;
  committee_id?: string | number | null;
  name?: string;
  subtitle?: string;
  academic_year?: string;
  start_date?: string;
  end_date?: string;
  venue?: string;
  adviser_name?: string;
  principal_name?: string;
};

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "") || null;
const numOrNull = (v: unknown) => {
  const n = Number(v);
  return v === "" || v === undefined || v === null || Number.isNaN(n) ? null : n;
};

function values(body: Body) {
  return {
    committee_id: numOrNull(body.committee_id),
    name: String(body.name ?? "").trim(),
    subtitle: str(body.subtitle),
    academic_year: str(body.academic_year),
    start_date: str(body.start_date),
    end_date: str(body.end_date),
    venue: str(body.venue),
    adviser_name: str(body.adviser_name),
    principal_name: str(body.principal_name),
  };
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const v = values((await req.json()) as Body);
  if (!v.name) return NextResponse.json({ success: false, message: "Event name is required" }, { status: 400 });

  try {
    const [row] = await db
      .insert(eventT)
      .values({ ...v, status: "OPEN", created_by: session.id, display: "Y" })
      .returning({ id: eventT.id });
    return NextResponse.json({ success: true, message: "Event saved", id: row.id });
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
  if (!id) return NextResponse.json({ success: false, message: "Event id is required" }, { status: 400 });
  if (!v.name) return NextResponse.json({ success: false, message: "Event name is required" }, { status: 400 });

  const guard = await assertEventEditable(id, session.roleId);
  if (guard.error) return guard.error;

  try {
    await db
      .update(eventT)
      .set({ ...v, updated_by: session.id, updated_at: new Date() })
      .where(eq(eventT.id, id));
    return NextResponse.json({ success: true, message: "Event updated", id });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ success: false, message: "Event id is required" }, { status: 400 });

  const guard = await assertEventEditable(id, session.roleId);
  if (guard.error) return guard.error;

  try {
    await db.update(eventT).set({ display: "N" }).where(eq(eventT.id, id));
    return NextResponse.json({ success: true, message: "Event deleted" });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}

/**
 * Finalise or reopen the event.
 *
 * Finalising recomputes every item's averages, grades and placings in one pass
 * so the published results match the stored scores exactly — rather than
 * trusting whatever place happened to be written as scores were typed.
 */
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { id?: number; status?: string };
  const id = Number(body.id);
  if (!id) return NextResponse.json({ success: false, message: "Event id is required" }, { status: 400 });
  if (!isEventStatus(body.status)) {
    return NextResponse.json(
      { success: false, message: `"${String(body.status)}" is not a valid event status.` },
      { status: 400 }
    );
  }
  const to = toEventStatus(body.status);

  const [current] = await db.select({ status: eventT.status }).from(eventT).where(eq(eventT.id, id));
  if (!current) return NextResponse.json({ success: false, message: "Event not found" }, { status: 404 });
  if (toEventStatus(current.status) === to) {
    return NextResponse.json({ success: false, message: `The event is already ${to.toLowerCase()}.` }, { status: 400 });
  }
  // Reopening a locked event is the Super Admin's call alone.
  if (!canEditEvent(current.status, session.roleId)) {
    return NextResponse.json(
      { success: false, message: eventTransitionError(current.status, session.roleId) },
      { status: 403 }
    );
  }

  try {
    if (to === "FINALISED") {
      await db.transaction(async (tx) => {
        const items = await tx
          .select({ id: eventItemT.id })
          .from(eventItemT)
          .where(and(eq(eventItemT.event_id, id), eq(eventItemT.display, "Y")));

        if (items.length) {
          const rows = await tx
            .select()
            .from(eventParticipantT)
            .where(
              and(
                inArray(
                  eventParticipantT.item_id,
                  items.map((i) => i.id)
                ),
                eq(eventParticipantT.display, "Y")
              )
            );

          // Recompute per item, then write each participant's final figures.
          for (const item of items) {
            const mine = rows.filter((r) => r.item_id === item.id);
            const withAvg = mine.map((r) => {
              const average = averageOf([
                toScore(r.judge1_score),
                toScore(r.judge2_score),
                toScore(r.judge3_score),
              ]);
              return { ...r, average };
            });
            const places = computePlaces(
              withAvg.map((r) => ({ id: r.id, average_score: r.average }))
            );
            for (const r of withAvg) {
              await tx
                .update(eventParticipantT)
                .set({
                  average_score: r.average === null ? null : String(r.average),
                  grade: gradeFor(r.average),
                  place: places.get(r.id) ?? null,
                })
                .where(eq(eventParticipantT.id, r.id));
            }
          }
        }

        await tx
          .update(eventT)
          .set({ status: to, updated_by: session.id, updated_at: new Date() })
          .where(eq(eventT.id, id));
      });
      return NextResponse.json({ success: true, message: "Results finalised", status: to });
    }

    await db
      .update(eventT)
      .set({ status: to, updated_by: session.id, updated_at: new Date() })
      .where(eq(eventT.id, id));
    return NextResponse.json({ success: true, message: "Event reopened", status: to });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}
