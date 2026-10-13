import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { db } from "@/db";
import { eventDutyT, eventItemT, eventT } from "@/db/schema";
import { buttonClasses } from "@/components/ui/button";
import PrintButton from "../../../report/_components/print-button";
import { formatDate } from "@/lib/utils";
import EventSheetStyle from "../../event-sheet-style";

/**
 * The printable duty list, laid out like the college's own sheet: on-stage
 * items grouped by stage, then the off-stage block, each row carrying its
 * time, coordinators and judges.
 */
export default async function DutyListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const eventId = Number(id);
  if (!Number.isInteger(eventId) || eventId <= 0) notFound();

  const [rows, items, duties] = await Promise.all([
    db
      .select()
      .from(eventT)
      .where(and(eq(eventT.id, eventId), eq(eventT.display, "Y")))
      .limit(1),
    db
      .select()
      .from(eventItemT)
      .where(and(eq(eventItemT.event_id, eventId), eq(eventItemT.display, "Y")))
      .orderBy(asc(eventItemT.sort_order), asc(eventItemT.id)),
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
      .orderBy(asc(eventDutyT.id)),
  ]);

  const ev = rows[0];
  if (!ev) notFound();

  const namesFor = (itemId: number, role: string) =>
    duties.filter((d) => d.item_id === itemId && (d.duty_role ?? "JUDGE") === role);

  // On-stage items group under their stage heading; everything off-stage goes
  // into one block, which is how the printed sheets are organised.
  const onStage = items.filter((i) => (i.category ?? "ON_STAGE") === "ON_STAGE");
  const offStage = items.filter((i) => i.category === "OFF_STAGE");
  const stages = [...new Set(onStage.map((i) => i.stage || "Stage 1"))];

  const block = (title: string, list: typeof items, showDate: boolean) => (
    <div key={title} className="mb-6">
      <h3 className="mb-1 text-center text-sm font-bold">{title}</h3>
      <table className="evt-table">
        <thead>
          <tr>
            <th style={{ width: "6%" }}>Sl.No</th>
            <th style={{ width: "28%" }}>Item</th>
            <th style={{ width: showDate ? "18%" : "12%" }}>{showDate ? "Date & Time" : "Time"}</th>
            <th style={{ width: "24%" }}>Coordinators</th>
            <th>Judges</th>
          </tr>
        </thead>
        <tbody>
          {list.length === 0 ? (
            <tr>
              <td colSpan={5} className="text-center">
                No items.
              </td>
            </tr>
          ) : (
            list.map((item, i) => (
              <tr key={item.id} className="evt-row">
                <td style={{ textAlign: "center" }}>{i + 1}</td>
                <td>
                  {item.name}
                  {item.topic && <div className="text-[11px] italic">Topic: {item.topic}</div>}
                </td>
                <td style={{ textAlign: "center" }}>
                  {showDate && item.scheduled_date ? `${formatDate(item.scheduled_date)} ` : ""}
                  {item.scheduled_time ?? ""}
                </td>
                <td>
                  {namesFor(item.id, "COORDINATOR").map((d) => (
                    <div key={d.id}>{d.person_name}</div>
                  ))}
                </td>
                <td>
                  {namesFor(item.id, "JUDGE").map((d) => (
                    <div key={d.id}>{d.person_name}</div>
                  ))}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-base font-semibold text-fg">Duty List — {ev.name}</h1>
        <div className="flex items-center gap-2">
          <Link href={`/event/${ev.id}`} className={buttonClasses({ variant: "outline", size: "sm" })}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <PrintButton />
        </div>
      </div>

      <div className="printable evt-sheet rounded-lg border border-line bg-white p-8 text-slate-900">
        <div className="mb-4 text-center">
          <div className="text-base font-bold uppercase">Government Polytechnic College Nedumkandam</div>
          <div className="text-sm font-semibold">
            {ev.name}
            {ev.subtitle ? ` (${ev.subtitle})` : ""}
          </div>
          <div className="text-sm font-bold">DUTY LIST</div>
          {ev.start_date && (
            <div className="mt-1 text-xs">DATE: {formatDate(ev.start_date)}</div>
          )}
        </div>

        {stages.map((stage) =>
          block(stage, onStage.filter((i) => (i.stage || "Stage 1") === stage), false)
        )}
        {offStage.length > 0 && block("OFF STAGE EVENTS", offStage, true)}

        <div className="mt-10 flex justify-between text-xs">
          <div>
            <div className="h-10" />
            <div>{ev.adviser_name || " "}</div>
            <div>Arts Adviser</div>
          </div>
          <div className="text-right">
            <div className="h-10" />
            <div>{ev.principal_name || " "}</div>
            <div>Principal</div>
          </div>
        </div>
      </div>

      <EventSheetStyle landscape />
    </div>
  );
}
