import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { db } from "@/db";
import { eventDutyT, eventItemT, eventParticipantT, eventT } from "@/db/schema";
import { buttonClasses } from "@/components/ui/button";
import PrintButton from "../../../../report/_components/print-button";
import { formatDate } from "@/lib/utils";
import { isEventLocked } from "@/lib/event-status";
import EventSheetStyle from "../../../event-sheet-style";
import Participants, { type Participant } from "./participants";

/**
 * One item: its participant register (editable), plus the two printable sheets
 * the college keeps — the signed participant list and the judges' score card.
 */
export default async function ItemPage({
  params,
}: {
  params: Promise<{ id: string; itemId: string }>;
}) {
  const { id, itemId } = await params;
  const eventId = Number(id);
  const itId = Number(itemId);
  if (!Number.isInteger(eventId) || !Number.isInteger(itId)) notFound();

  const [eventRows, itemRows, participants, duties] = await Promise.all([
    db
      .select()
      .from(eventT)
      .where(and(eq(eventT.id, eventId), eq(eventT.display, "Y")))
      .limit(1),
    db
      .select()
      .from(eventItemT)
      .where(and(eq(eventItemT.id, itId), eq(eventItemT.display, "Y")))
      .limit(1),
    db
      .select()
      .from(eventParticipantT)
      .where(and(eq(eventParticipantT.item_id, itId), eq(eventParticipantT.display, "Y")))
      .orderBy(asc(eventParticipantT.chest_no), asc(eventParticipantT.id)),
    db
      .select({ id: eventDutyT.id, person_name: eventDutyT.person_name, duty_role: eventDutyT.duty_role })
      .from(eventDutyT)
      .where(and(eq(eventDutyT.item_id, itId), eq(eventDutyT.display, "Y")))
      .orderBy(asc(eventDutyT.id)),
  ]);

  const ev = eventRows[0];
  const item = itemRows[0];
  if (!ev || !item || item.event_id !== eventId) notFound();

  const locked = isEventLocked(ev.status);
  const judges = duties.filter((d) => (d.duty_role ?? "JUDGE") === "JUDGE");

  const rows: Participant[] = participants.map((p) => ({
    id: p.id,
    chest_no: p.chest_no,
    participant_name: p.participant_name,
    class_name: p.class_name,
    phone: p.phone,
    parent_name: p.parent_name,
    parent_phone: p.parent_phone,
    judge1_score: p.judge1_score,
    judge2_score: p.judge2_score,
    judge3_score: p.judge3_score,
    average_score: p.average_score,
    grade: p.grade,
    place: p.place,
    remarks: p.remarks,
  }));

  const heading = (
    <div className="mb-3 text-center">
      <div className="text-base font-bold uppercase">Government Polytechnic College Nedumkandam</div>
      <div className="text-sm font-semibold">
        {ev.name}
        {ev.subtitle ? ` — ${ev.subtitle}` : ""}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-base font-semibold text-fg">{item.name}</h1>
          <p className="text-sm text-muted">
            {[
              ev.name,
              item.scheduled_date ? formatDate(item.scheduled_date) : null,
              item.scheduled_time,
              item.stage,
              item.topic ? `Topic: ${item.topic}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/event/${eventId}`} className={buttonClasses({ variant: "outline", size: "sm" })}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <PrintButton label="Print sheets" />
        </div>
      </div>

      <Participants itemId={itId} rows={rows} locked={locked} />

      {/* ---------- printable sheet 1: participant register ---------- */}
      <div className="printable evt-sheet rounded-lg border border-line bg-white p-8 text-slate-900">
        <div className="evt-page">
          {heading}
          <div className="mb-2 text-sm">
            <strong>Item Name:</strong> {item.name}
          </div>
          <table className="evt-table">
            <thead>
              <tr>
                <th style={{ width: "8%" }}>Sl.No</th>
                <th>Name</th>
                <th style={{ width: "14%" }}>Class</th>
                <th style={{ width: "14%" }}>Chest No</th>
                <th style={{ width: "20%" }}>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {/* Pad to 20 rows so the printed register has blank lines to
                  write on, exactly like the sheet it replaces. */}
              {Array.from({ length: Math.max(20, rows.length) }, (_, i) => {
                const p = rows[i];
                return (
                  <tr key={p?.id ?? `blank-${i}`} className="evt-row">
                    <td style={{ textAlign: "center" }}>{String(i + 1).padStart(2, "0")}</td>
                    <td>{p?.participant_name ?? ""}</td>
                    <td style={{ textAlign: "center" }}>{p?.class_name ?? ""}</td>
                    <td style={{ textAlign: "center" }}>{p?.chest_no ?? ""}</td>
                    <td style={{ textAlign: "center" }}>
                      {p?.place ? `${p.place}${p.place === 1 ? "st" : p.place === 2 ? "nd" : "rd"}` : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {item.topic && <div className="mt-6 text-sm">Topic: {item.topic}</div>}
        </div>

        {/* ---------- printable sheet 2: score card ---------- */}
        <div>
          {heading}
          <div className="mb-1 text-center text-sm font-semibold">Score Card</div>
          <div className="mb-2 text-sm">
            <strong>NAME OF ITEM:</strong> {item.name}
          </div>
          <table className="evt-table">
            <thead>
              <tr>
                <th style={{ width: "8%" }}>Sl. No.</th>
                <th style={{ width: "14%" }}>Chest No.</th>
                <th>Judge 1</th>
                <th>Judge 2</th>
                <th>Judge 3</th>
                <th>Average (Out of 100)</th>
                <th style={{ width: "10%" }}>Grade</th>
                <th style={{ width: "14%" }}>Remark</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: Math.max(10, rows.length) }, (_, i) => {
                const p = rows[i];
                return (
                  <tr key={p?.id ?? `s-${i}`} className="evt-row">
                    <td style={{ textAlign: "center" }}>{i + 1}</td>
                    <td style={{ textAlign: "center" }}>{p?.chest_no ?? ""}</td>
                    <td style={{ textAlign: "center" }}>{p?.judge1_score ?? ""}</td>
                    <td style={{ textAlign: "center" }}>{p?.judge2_score ?? ""}</td>
                    <td style={{ textAlign: "center" }}>{p?.judge3_score ?? ""}</td>
                    <td style={{ textAlign: "center" }}>{p?.average_score ?? ""}</td>
                    <td style={{ textAlign: "center" }}>{p?.grade ?? ""}</td>
                    <td style={{ textAlign: "center" }}>{p?.remarks ?? ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="mt-6 text-sm">
            <div className="mb-1 font-semibold">Signatures with Date:</div>
            {(judges.length ? judges : [null, null, null]).map((j, i) => (
              <div key={j?.id ?? i} className="mb-3">
                Judge {i + 1}: {j?.person_name ?? ""}
                <span className="ml-2 inline-block w-48 border-b border-slate-400" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <EventSheetStyle />
    </div>
  );
}
