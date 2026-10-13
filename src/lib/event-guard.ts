import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { eventItemT, eventParticipantT, eventT } from "@/db/schema";
import { eventTransitionError, toEventStatus } from "@/lib/event-status";

/**
 * Server-side lock for everything hanging off an event.
 *
 * Lives here rather than in a route file because Next validates the exports of
 * a route module — only HTTP handlers belong there — and because all four
 * event routes need it.
 */
export async function assertEventEditable(eventId: number, roleId: number) {
  const [row] = await db
    .select({ status: eventT.status })
    .from(eventT)
    .where(eq(eventT.id, eventId));
  if (!row) {
    return { error: NextResponse.json({ success: false, message: "Event not found" }, { status: 404 }) };
  }
  const refusal = eventTransitionError(row.status, roleId);
  if (refusal) {
    return { error: NextResponse.json({ success: false, message: refusal }, { status: 403 }) };
  }
  return { status: toEventStatus(row.status) };
}

/** The event an item belongs to, or null when the item is gone. */
export async function eventIdOfItem(itemId: number) {
  const [row] = await db
    .select({ event_id: eventItemT.event_id })
    .from(eventItemT)
    .where(eq(eventItemT.id, itemId));
  return row?.event_id ?? null;
}

/** The event a participant belongs to, via their item. */
export async function eventIdOfParticipant(participantId: number) {
  const [row] = await db
    .select({ item_id: eventParticipantT.item_id })
    .from(eventParticipantT)
    .where(eq(eventParticipantT.id, participantId));
  return row ? eventIdOfItem(row.item_id) : null;
}
