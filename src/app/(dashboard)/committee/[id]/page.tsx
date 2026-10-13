import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { ArrowLeft, Pencil, CalendarDays, Users, ScrollText, CheckCircle2 } from "lucide-react";
import { db } from "@/db";
import {
  attachmentT,
  committeeMemberT,
  committeeT,
  designationMasterT,
  eventT,
  staffT,
} from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { COMMITTEE_TYPE_LABEL } from "@/lib/committee";
import { Paperclip } from "lucide-react";
import AttachmentPanel, { type AttachmentRow } from "@/components/attachment-panel";
import CommitteeMembers, { type Member } from "../committee-members";

/** A committee: its appointment order, the people named in it, and its events. */
export default async function CommitteeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const committeeId = Number(id);
  if (!Number.isInteger(committeeId) || committeeId <= 0) notFound();

  const [rows, memberRows, staffRows, events, fileRows, designationRows] = await Promise.all([
    db
      .select()
      .from(committeeT)
      .where(and(eq(committeeT.id, committeeId), eq(committeeT.display, "Y")))
      .limit(1),
    db
      .select()
      .from(committeeMemberT)
      .where(
        and(eq(committeeMemberT.committee_id, committeeId), eq(committeeMemberT.display, "Y"))
      )
      .orderBy(asc(committeeMemberT.sort_order), asc(committeeMemberT.id)),
    db
      .select({ id: staffT.id, staff_name: staffT.staff_name, designation: staffT.designation })
      .from(staffT)
      .where(eq(staffT.display, "Y"))
      .orderBy(asc(staffT.staff_name)),
    db
      .select({
        id: eventT.id,
        name: eventT.name,
        subtitle: eventT.subtitle,
        start_date: eventT.start_date,
        status: eventT.status,
      })
      .from(eventT)
      .where(and(eq(eventT.committee_id, committeeId), eq(eventT.display, "Y")))
      .orderBy(asc(eventT.id)),
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
          eq(attachmentT.owner_type, "COMMITTEE"),
          eq(attachmentT.owner_id, committeeId),
          eq(attachmentT.display, "Y")
        )
      )
      .orderBy(asc(attachmentT.id)),
    db
      .select({ name: designationMasterT.designation_name })
      .from(designationMasterT)
      .where(eq(designationMasterT.display, "Y"))
      .orderBy(asc(designationMasterT.designation_name)),
  ]);

  const c = rows[0];
  if (!c) notFound();

  const members: Member[] = memberRows.map((m) => ({
    id: m.id,
    staff_id: m.staff_id,
    member_name: m.member_name,
    designation: m.designation,
    member_role: m.member_role ?? "MEMBER",
    sort_order: m.sort_order ?? 0,
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

  const hasOrder = files.some((f) => f.category === "ORDER");

  // The staff member's own designation travels with the option, so picking
  // someone fills the designation field the way the hint promises.
  const staff = staffRows.map((s) => ({
    value: String(s.id),
    label: s.designation ? `${s.staff_name} — ${s.designation}` : s.staff_name,
    designation: s.designation ?? "",
  }));

  const designations = designationRows.map((d) => d.name);

  const stat = (icon: React.ReactNode, label: string, value: string) => (
    <div className="flex items-center gap-2.5 rounded-xl bg-white/10 px-3 py-2 backdrop-blur-sm">
      <span className="text-white/80">{icon}</span>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-white">{value}</div>
        <div className="text-[11px] text-white/70">{label}</div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Hero — the committee's identity at a glance. */}
      <div className="grad-violet relative overflow-hidden rounded-2xl p-6 text-white">
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-1 inline-flex rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium backdrop-blur-sm">
              {COMMITTEE_TYPE_LABEL[c.committee_type ?? "OTHER"] ?? c.committee_type}
            </div>
            <h1 className="truncate text-2xl font-bold">{c.name}</h1>
            {c.description && (
              <p className="mt-1 max-w-2xl text-sm text-white/80">{c.description}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/committee"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium backdrop-blur-sm transition-colors hover:bg-white/25"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
            <Link
              href={`/committee/${c.id}/edit`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium backdrop-blur-sm transition-colors hover:bg-white/25"
            >
              <Pencil className="h-4 w-4" /> Edit
            </Link>
          </div>
        </div>

        <div className="relative mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {stat(<CalendarDays className="h-4 w-4" />, "Academic year", c.academic_year || "—")}
          {stat(<Users className="h-4 w-4" />, "Members", String(members.length))}
          {stat(<ScrollText className="h-4 w-4" />, "Order", c.order_no || "Not recorded")}
          {stat(
            hasOrder ? <CheckCircle2 className="h-4 w-4" /> : <Paperclip className="h-4 w-4" />,
            hasOrder ? "Order uploaded" : "Files",
            files.length ? `${files.length} file${files.length === 1 ? "" : "s"}` : "None yet"
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle>Members</CardTitle>
          </CardHeader>
          <CardContent>
            <CommitteeMembers
              committeeId={c.id}
              members={members}
              staff={staff}
              designations={designations}
            />
          </CardContent>
        </Card>

        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
              {(c.order_no || c.order_date) && (
                <span className="text-xs text-muted">
                  {c.order_no ? `No. ${c.order_no}` : ""}
                  {c.order_date ? ` · ${formatDate(c.order_date)}` : ""}
                </span>
              )}
            </CardHeader>
            <CardContent>
              <AttachmentPanel
                ownerType="COMMITTEE"
                ownerId={c.id}
                files={files}
                defaultCategory="ORDER"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Events</CardTitle>
              <Link href="/event/new" className={buttonClasses({ variant: "outline", size: "sm" })}>
                New event
              </Link>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <p className="text-sm text-muted">
                  This committee has not run an event yet.
                </p>
              ) : (
                <ul className="divide-y divide-line">
                  {events.map((e) => (
                    <li key={e.id}>
                      <Link
                        href={`/event/${e.id}`}
                        className="flex items-center justify-between gap-3 py-2.5 transition-colors hover:text-accent"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-fg">{e.name}</div>
                          <div className="truncate text-xs text-muted">
                            {[e.subtitle, e.start_date ? formatDate(e.start_date) : null]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                        </div>
                        <span className="shrink-0 text-xs text-faint">
                          {e.status === "FINALISED" ? "Finalised" : "Open"}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
