import Link from "next/link";
import { desc, eq, sql, and } from "drizzle-orm";
import { Plus, Users } from "lucide-react";
import { db } from "@/db";
import { attachmentT, committeeT, eventItemT, eventParticipantT, eventT } from "@/db/schema";
import { buttonClasses } from "@/components/ui/button";
import EventList from "./event-list";

// Events (arts festivals) run by the institution's committees.
export default async function EventPage() {
  const rows = await db
    .select({
      id: eventT.id,
      name: eventT.name,
      subtitle: eventT.subtitle,
      academic_year: eventT.academic_year,
      start_date: eventT.start_date,
      end_date: eventT.end_date,
      venue: eventT.venue,
      status: eventT.status,
      committee_name: committeeT.name,
      // Several one-to-many joins multiply each other's rows, so every count
      // here is DISTINCT — otherwise items would be multiplied by participants.
      item_count: sql<number>`count(distinct ${eventItemT.id})::int`,
      on_stage_count: sql<number>`count(distinct ${eventItemT.id}) filter (
        where ${eventItemT.category} = 'ON_STAGE'
      )::int`,
      off_stage_count: sql<number>`count(distinct ${eventItemT.id}) filter (
        where ${eventItemT.category} = 'OFF_STAGE'
      )::int`,
      participant_count: sql<number>`count(distinct ${eventParticipantT.id})::int`,
      file_count: sql<number>`count(distinct ${attachmentT.id})::int`,
    })
    .from(eventT)
    .leftJoin(committeeT, eq(eventT.committee_id, committeeT.id))
    .leftJoin(
      eventItemT,
      and(eq(eventItemT.event_id, eventT.id), eq(eventItemT.display, "Y"))
    )
    .leftJoin(
      eventParticipantT,
      and(
        eq(eventParticipantT.item_id, eventItemT.id),
        eq(eventParticipantT.display, "Y")
      )
    )
    .leftJoin(
      attachmentT,
      and(
        eq(attachmentT.owner_type, "EVENT"),
        eq(attachmentT.owner_id, eventT.id),
        eq(attachmentT.display, "Y")
      )
    )
    .where(eq(eventT.display, "Y"))
    .groupBy(eventT.id, committeeT.name)
    .orderBy(desc(eventT.id));

  return (
    <EventList
      rows={rows}
      actions={
        <>
          <Link href="/committee" className={buttonClasses({ variant: "outline", size: "sm" })}>
            <Users className="h-4 w-4" /> Committees
          </Link>
          <Link href="/event/new" className={buttonClasses({ size: "sm" })}>
            <Plus className="h-4 w-4" /> New
          </Link>
        </>
      }
    />
  );
}
