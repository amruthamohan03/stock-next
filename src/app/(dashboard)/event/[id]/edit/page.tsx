import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { eventT } from "@/db/schema";
import { getCommitteeOptions } from "@/lib/committee-queries";
import EventForm, { type EventInitial } from "../../event-form";

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const eventId = Number(id);
  if (!Number.isInteger(eventId) || eventId <= 0) notFound();

  const [committees, rows] = await Promise.all([
    getCommitteeOptions(),
    db
      .select()
      .from(eventT)
      .where(and(eq(eventT.id, eventId), eq(eventT.display, "Y")))
      .limit(1),
  ]);

  const ev = rows[0];
  if (!ev) notFound();

  const initial: EventInitial = {
    id: ev.id,
    committee_id: s(ev.committee_id),
    name: s(ev.name),
    subtitle: s(ev.subtitle),
    academic_year: s(ev.academic_year),
    start_date: s(ev.start_date),
    end_date: s(ev.end_date),
    venue: s(ev.venue),
    adviser_name: s(ev.adviser_name),
    principal_name: s(ev.principal_name),
  };

  return <EventForm committees={committees} initial={initial} />;
}
