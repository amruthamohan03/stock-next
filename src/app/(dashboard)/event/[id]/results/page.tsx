import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { ArrowLeft, Award } from "lucide-react";
import { db } from "@/db";
import { eventItemT, eventParticipantT, eventT } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import PrintButton from "../../../report/_components/print-button";
import { isEventLocked, ordinal } from "@/lib/event-status";
import EventSheetStyle from "../../event-sheet-style";

/** Tint for a grade chip — opacity forms so they read on dark and light. */
const GRADE_TONE: Record<string, string> = {
  A: "bg-emerald-500/15 text-emerald-500 ring-emerald-500/25",
  B: "bg-sky-500/15 text-sky-500 ring-sky-500/25",
  C: "bg-amber-500/15 text-amber-500 ring-amber-500/25",
};

/**
 * Results and certificates.
 *
 * The on-screen table lists every placed entrant; printing produces one
 * Certificate of Merit per winner, matching the college's template. Placings
 * come from the stored `place`, which is computed when the event is finalised —
 * so an unfinalised event prints nothing, rather than certificates that might
 * change.
 *
 * Some events are graded rather than placed: the inter-poly festival awards
 * A/B/C and issues its own certificates, so there is no place to compute. Those
 * grades are listed here too, otherwise the results of such an event would be
 * reachable only item by item.
 */
export default async function ResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const eventId = Number(id);
  if (!Number.isInteger(eventId) || eventId <= 0) notFound();

  const [rows, winners] = await Promise.all([
    db
      .select()
      .from(eventT)
      .where(and(eq(eventT.id, eventId), eq(eventT.display, "Y")))
      .limit(1),
    db
      .select({
        id: eventParticipantT.id,
        name: eventParticipantT.participant_name,
        class_name: eventParticipantT.class_name,
        chest_no: eventParticipantT.chest_no,
        average: eventParticipantT.average_score,
        grade: eventParticipantT.grade,
        place: eventParticipantT.place,
        item_name: eventItemT.name,
        category: eventItemT.category,
        sort_order: eventItemT.sort_order,
      })
      .from(eventParticipantT)
      .innerJoin(eventItemT, eq(eventItemT.id, eventParticipantT.item_id))
      .where(
        and(
          eq(eventItemT.event_id, eventId),
          eq(eventItemT.display, "Y"),
          eq(eventParticipantT.display, "Y")
        )
      )
      .orderBy(asc(eventItemT.sort_order), asc(eventItemT.id), asc(eventParticipantT.place)),
  ]);

  const ev = rows[0];
  if (!ev) notFound();

  const locked = isEventLocked(ev.status);
  const placed = winners.filter((w) => w.place !== null);
  // Graded but unplaced — an externally judged event, or an item still open.
  const graded = winners.filter((w) => w.place === null && w.grade);

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-base font-semibold text-fg">Results — {ev.name}</h1>
          <p className="text-sm text-muted">
            {placed.length > 0
              ? `${placed.length} placed ${placed.length === 1 ? "entrant" : "entrants"}`
              : graded.length > 0
                ? `${graded.length} graded ${graded.length === 1 ? "entrant" : "entrants"}`
                : "No results yet"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/event/${ev.id}`} className={buttonClasses({ variant: "outline", size: "sm" })}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          {placed.length > 0 && <PrintButton label="Print certificates" />}
        </div>
      </div>

      {!locked && (
        <Card className="no-print">
          <CardContent className="pt-5">
            <p className="text-sm text-muted">
              This event is still open. Placings are computed when you{" "}
              <Link href={`/event/${ev.id}`} className="text-accent hover:underline">
                finalise the results
              </Link>
              , and certificates print from those placings.
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="no-print">
        <CardHeader>
          <CardTitle>{placed.length > 0 ? "Winners" : "Grades awarded"}</CardTitle>
        </CardHeader>
        <CardContent>
          {placed.length === 0 ? (
            graded.length === 0 ? (
              <p className="text-sm text-muted">No placings or grades yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs text-muted">
                      <th className="px-2 py-2">Item</th>
                      <th className="px-2 py-2">Name</th>
                      <th className="px-2 py-2">Class</th>
                      <th className="px-2 py-2">Chest / Reg no</th>
                      <th className="px-2 py-2 text-center">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {graded.map((w) => (
                      <tr key={w.id} className="border-b border-line/60">
                        <td className="px-2 py-2 text-muted">{w.item_name}</td>
                        <td className="px-2 py-2 font-medium text-fg">{w.name}</td>
                        <td className="px-2 py-2 text-muted">{w.class_name || "—"}</td>
                        <td className="px-2 py-2 tabular-nums text-muted">{w.chest_no || "—"}</td>
                        <td className="px-2 py-2 text-center">
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ${
                              GRADE_TONE[w.grade ?? ""] ?? "bg-elevated text-muted ring-line"
                            }`}
                          >
                            {w.grade}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <th className="px-2 py-2">Item</th>
                    <th className="px-2 py-2">Place</th>
                    <th className="px-2 py-2">Name</th>
                    <th className="px-2 py-2">Class</th>
                    <th className="px-2 py-2 text-right">Average</th>
                    <th className="px-2 py-2 text-center">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {placed.map((w) => (
                    <tr key={w.id} className="border-b border-line/60">
                      <td className="px-2 py-2 text-muted">{w.item_name}</td>
                      <td className="px-2 py-2">
                        <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-xs font-medium text-amber-500">
                          {ordinal(w.place)}
                        </span>
                      </td>
                      <td className="px-2 py-2 font-medium text-fg">{w.name}</td>
                      <td className="px-2 py-2 text-muted">{w.class_name || "—"}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{w.average ?? "—"}</td>
                      <td className="px-2 py-2 text-center">{w.grade || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---------- one certificate per winner, one per printed page ---------- */}
      {placed.length > 0 && (
        <div className="printable evt-sheet space-y-4">
          {placed.map((w) => (
            <div
              key={w.id}
              className="evt-page relative mx-auto flex min-h-[18rem] max-w-4xl flex-col items-center justify-center rounded-lg border-4 border-amber-500/70 bg-white p-10 text-center text-slate-900"
            >
              <div className="text-lg font-bold uppercase tracking-wide">
                Govt Polytechnic College Nedumkandam
              </div>
              <div className="mt-1 text-xl font-extrabold text-sky-700">{ev.name}</div>
              <div className="mt-3 flex items-center gap-2 text-2xl font-bold italic">
                <Award className="h-6 w-6" /> Certificate Of Merit
              </div>

              <p className="mt-5 max-w-2xl text-sm leading-7">
                This is to certify that{" "}
                <span className="font-semibold underline underline-offset-4">{w.name}</span>
                {w.class_name ? ` (${w.class_name})` : ""} has secured{" "}
                <span className="font-semibold underline underline-offset-4">{ordinal(w.place)}</span>{" "}
                place in{" "}
                <span className="font-semibold underline underline-offset-4">{w.item_name}</span>. The
                hard work and dedication are sincerely appreciated.
              </p>

              <div className="mt-10 flex w-full max-w-2xl items-end justify-between text-xs">
                <div className="text-left">
                  <div>Date</div>
                </div>
                <div className="text-center">
                  <div className="h-8" />
                  <div className="font-medium">{ev.adviser_name || " "}</div>
                  <div>Arts Adviser</div>
                </div>
                <div className="text-center">
                  <div className="h-8" />
                  <div className="font-medium">{ev.principal_name || " "}</div>
                  <div>Principal</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <EventSheetStyle landscape />
    </div>
  );
}
