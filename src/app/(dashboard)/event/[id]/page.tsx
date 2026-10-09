import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, sql } from "drizzle-orm";
import { ArrowLeft, Pencil, CalendarDays, Users, ListChecks, Paperclip } from "lucide-react";
import { db } from "@/db";
import {
  attachmentT,
  committeeT,
  eventDutyT,
  eventItemT,
  eventParticipantT,
  eventT,
  staffT,
} from "@/db/schema";
import { buttonClasses } from "@/components/ui/button";
import { getSession } from "@/lib/session";
import { formatDate } from "@/lib/utils";
import { isEventLocked, toEventStatus } from "@/lib/event-status";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AttachmentPanel, { type AttachmentRow } from "@/components/attachment-panel";
import EventItems, { type Item } from "./event-items";

/** One glass tile in the hero strip. */
function heroStat(icon: React.ReactNode, label: string, value: string) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-white/10 px-3 py-2 backdrop-blur-sm">
      <span className="text-white/80">{icon}</span>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-white">{value}</div>
        <div className="text-[11px] text-white/70">{label}</div>
      </div>
    </div>
  );
}

/** The event hub — programme, duty allocation and the finalise control. */
export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const eventId = Number(id);
  if (!Number.isInteger(eventId) || eventId <= 0) notFound();

  const [session, rows, items, duties, staffRows, fileRows] = await Promise.all([
    getSession(),
    db
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
      })
      .from(eventT)
      .leftJoin(committeeT, eq(eventT.committee_id, committeeT.id))
      .where(and(eq(eventT.id, eventId), eq(eventT.display, "Y")))
      .limit(1),
    // Items with their participant counts — one aggregate, not a query per item.
    db
      .select({
        id: eventItemT.id,
        name: eventItemT.name,
        category: eventItemT.category,
        item_type: eventItemT.item_type,
        stage: eventItemT.stage,
        venue: eventItemT.venue,
        scheduled_date: eventItemT.scheduled_date,
        scheduled_time: eventItemT.scheduled_time,
        topic: eventItemT.topic,
        sort_order: eventItemT.sort_order,
        participant_count: sql<number>`count(${eventParticipantT.id})::int`,
      })
      .from(eventItemT)
      .leftJoin(
        eventParticipantT,
        and(
          eq(eventParticipantT.item_id, eventItemT.id),
          eq(eventParticipantT.display, "Y")
        )
      )
      .where(and(eq(eventItemT.event_id, eventId), eq(eventItemT.display, "Y")))
      .groupBy(eventItemT.id)
      .orderBy(asc(eventItemT.sort_order), asc(eventItemT.id)),
    // All duties for the event in one go, grouped in memory below.
    db
      .select({
        id: eventDutyT.id,
        item_id: eventDutyT.item_id,
        person_name: eventDutyT.person_name,
        duty_role: eventDutyT.duty_role,
      })
      .from(eventDutyT)
      .innerJoin(eventItemT, eq(eventItemT.id, eventDutyT.item_id))
      .where(and(eq(eventItemT.event_id, eventId), eq(eventDutyT.display, "Y")))
      .orderBy(asc(eventDutyT.duty_role), asc(eventDutyT.id)),
    db
      .select({ id: staffT.id, staff_name: staffT.staff_name, designation: staffT.designation })
      .from(staffT)
      .where(eq(staffT.display, "Y"))
      .orderBy(asc(staffT.staff_name)),
    db
      .select({
        id: attachmentT.id,
        category: attachmentT.category,
        title: attachmentT.title,
        file_name: attachmentT.file_name,
        file_type: attachmentT.file_type,
        file_size: attachmentT.file_size,
        created_at: attachmentT.created_at,
      })
      .from(attachmentT)
      .where(
        and(
          eq(attachmentT.owner_type, "EVENT"),
          eq(attachmentT.owner_id, eventId),
          eq(attachmentT.display, "Y")
        )
      )
      .orderBy(asc(attachmentT.id)),
  ]);

  const ev = rows[0];
  if (!ev) notFound();

  const dutiesByItem = new Map<number, Item["duties"]>();
  for (const d of duties) {
    const list = dutiesByItem.get(d.item_id) ?? [];
    list.push({ id: d.id, person_name: d.person_name, duty_role: d.duty_role ?? "JUDGE" });
    dutiesByItem.set(d.item_id, list);
  }

  const withDuties: Item[] = items.map((i) => ({
    id: i.id,
    name: i.name,
    category: i.category ?? "ON_STAGE",
    item_type: i.item_type ?? "SINGLE",
    stage: i.stage,
    venue: i.venue,
    scheduled_date: i.scheduled_date,
    scheduled_time: i.scheduled_time,
    topic: i.topic,
    sort_order: i.sort_order ?? 0,
    participant_count: i.participant_count,
    duties: dutiesByItem.get(i.id) ?? [],
  }));

  const files: AttachmentRow[] = fileRows.map((f) => ({
    id: f.id,
    category: f.category ?? "OTHER",
    title: f.title,
    file_name: f.file_name,
    file_type: f.file_type,
    file_size: f.file_size,
    created_at: f.created_at ? String(f.created_at) : null,
  }));

  const participantTotal = items.reduce((n, i) => n + (i.participant_count ?? 0), 0);

  const staff = staffRows.map((s) => ({
    value: String(s.id),
    label: s.designation ? `${s.staff_name} — ${s.designation}` : s.staff_name,
  }));

  return (
    <div className="space-y-4">
      {/* Hero — mirrors the committee page so the two read as one module. */}
      <div className="grad-blue relative overflow-hidden rounded-2xl p-6 text-white">
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            {ev.committee_name && (
              <div className="mb-1 inline-flex rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium backdrop-blur-sm">
                {ev.committee_name}
              </div>
            )}
            <h1 className="truncate text-2xl font-bold">{ev.name}</h1>
            {ev.subtitle && <p className="mt-1 text-sm text-white/80">{ev.subtitle}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/event"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium backdrop-blur-sm transition-colors hover:bg-white/25"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
            {!isEventLocked(ev.status) && (
              <Link
                href={`/event/${ev.id}/edit`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium backdrop-blur-sm transition-colors hover:bg-white/25"
              >
                <Pencil className="h-4 w-4" /> Edit
              </Link>
            )}
          </div>
        </div>

        <div className="relative mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {heroStat(
            <CalendarDays className="h-4 w-4" />,
            "Dates",
            ev.start_date ? formatDate(ev.start_date) : "Not set"
          )}
          {heroStat(<ListChecks className="h-4 w-4" />, "Items", String(items.length))}
          {heroStat(<Users className="h-4 w-4" />, "Participants", String(participantTotal))}
          {heroStat(
            <Paperclip className="h-4 w-4" />,
            "Files",
            files.length ? String(files.length) : "None yet"
          )}
        </div>
      </div>

      <EventItems
        eventId={ev.id}
        status={toEventStatus(ev.status)}
        items={withDuties}
        staff={staff}
        isSuperAdmin={session?.roleId === 1}
      />

      <Card>
        <CardHeader>
          <CardTitle>Photos &amp; Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <AttachmentPanel ownerType="EVENT" ownerId={ev.id} files={files} defaultCategory="PHOTO" />
        </CardContent>
      </Card>
    </div>
  );
}
