import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import {
  ArrowLeft,
  Pencil,
  CalendarDays,
  User,
  Paperclip,
  Building2,
  Award,
} from "lucide-react";
import { db } from "@/db";
import {
  attachmentT,
  departmentMasterT,
  fdpT,
  staffT,
  subjectMasterT,
} from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AttachmentPanel, { type AttachmentRow } from "@/components/attachment-panel";
import { formatDate } from "@/lib/utils";
import { FDP_MODE_GRAD, FDP_MODE_LABEL, durationLabel, toFdpMode, topicList } from "@/lib/fdp";

/** One FDP record: the programme, who attended, and the paperwork. */
export default async function FdpDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fdpId = Number(id);
  if (!Number.isInteger(fdpId) || fdpId <= 0) notFound();

  const [rows, fileRows] = await Promise.all([
    db
      .select({
        id: fdpT.id,
        title: fdpT.title,
        faculty_name: fdpT.faculty_name,
        staff_name: staffT.staff_name,
        staff_designation: staffT.designation,
        organizer: fdpT.organizer,
        collaborator: fdpT.collaborator,
        mode: fdpT.mode,
        venue: fdpT.venue,
        start_date: fdpT.start_date,
        end_date: fdpT.end_date,
        academic_year: fdpT.academic_year,
        topics: fdpT.topics,
        remarks: fdpT.remarks,
        subject_name: subjectMasterT.subject_name,
        subject_code: subjectMasterT.subject_code,
        department_name: departmentMasterT.department_name,
      })
      .from(fdpT)
      .leftJoin(staffT, eq(fdpT.staff_id, staffT.id))
      .leftJoin(subjectMasterT, eq(fdpT.subject_id, subjectMasterT.id))
      .leftJoin(departmentMasterT, eq(fdpT.department_id, departmentMasterT.id))
      .where(and(eq(fdpT.id, fdpId), eq(fdpT.display, "Y")))
      .limit(1),
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
          eq(attachmentT.owner_type, "FDP"),
          eq(attachmentT.owner_id, fdpId),
          eq(attachmentT.display, "Y")
        )
      )
      .orderBy(asc(attachmentT.id)),
  ]);

  const r = rows[0];
  if (!r) notFound();

  const mode = toFdpMode(r.mode);
  const topics = topicList(r.topics);
  const faculty = r.faculty_name || r.staff_name;

  const files: AttachmentRow[] = fileRows.map((f) => ({
    id: f.id,
    category: f.category ?? "OTHER",
    title: f.title,
    file_name: f.file_name,
    file_type: f.file_type,
    file_size: f.file_size,
    created_at: f.created_at ? String(f.created_at) : null,
  }));
  const hasCertificate = files.some((f) => f.category === "CERTIFICATE");

  const stat = (icon: React.ReactNode, label: string, value: string) => (
    <div className="flex items-center gap-2.5 rounded-xl bg-white/10 px-3 py-2 backdrop-blur-sm">
      <span className="text-white/80">{icon}</span>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-white">{value}</div>
        <div className="text-[11px] text-white/70">{label}</div>
      </div>
    </div>
  );

  const dateRange = r.start_date
    ? `${formatDate(r.start_date)}${
        r.end_date && String(r.end_date) !== String(r.start_date)
          ? ` – ${formatDate(r.end_date)}`
          : ""
      }`
    : "Not set";

  return (
    <div className="space-y-4">
      <div className={`${FDP_MODE_GRAD[mode]} relative overflow-hidden rounded-2xl p-6 text-white`}>
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium backdrop-blur-sm">
                {FDP_MODE_LABEL[mode]}
              </span>
              {hasCertificate && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium backdrop-blur-sm">
                  <Award className="h-3 w-3" /> Certificate on file
                </span>
              )}
            </div>
            <h1 className="truncate text-2xl font-bold">{r.title}</h1>
            <p className="mt-1 text-sm text-white/80">
              {[r.organizer, r.collaborator && `in association with ${r.collaborator}`]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/fdp"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium backdrop-blur-sm transition-colors hover:bg-white/25"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
            <Link
              href={`/fdp/${r.id}/edit`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium backdrop-blur-sm transition-colors hover:bg-white/25"
            >
              <Pencil className="h-4 w-4" /> Edit
            </Link>
          </div>
        </div>

        <div className="relative mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {stat(<User className="h-4 w-4" />, "Faculty", faculty || "Not recorded")}
          {stat(<CalendarDays className="h-4 w-4" />, durationLabel(r.start_date, r.end_date) || "Dates", dateRange)}
          {stat(<Building2 className="h-4 w-4" />, "Academic year", r.academic_year || "—")}
          {stat(
            <Paperclip className="h-4 w-4" />,
            "Files",
            files.length ? String(files.length) : "None yet"
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <div className="space-y-4 xl:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Certificate &amp; Schedule</CardTitle>
            </CardHeader>
            <CardContent>
              <AttachmentPanel
                ownerType="FDP"
                ownerId={r.id}
                files={files}
                defaultCategory="CERTIFICATE"
              />
            </CardContent>
          </Card>

          {topics.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Topics Covered</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {topics.map((t, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-fg">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                      <span className="min-w-0 break-words">{t}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-line text-sm">
              {(
                [
                  ["Faculty", faculty],
                  ["Designation", r.staff_designation],
                  ["Organised by", r.organizer],
                  ["In association with", r.collaborator],
                  ["Mode", FDP_MODE_LABEL[mode]],
                  ["Venue / platform", r.venue],
                  ["Dates", r.start_date ? dateRange : null],
                  ["Duration", durationLabel(r.start_date, r.end_date)],
                  ["Academic year", r.academic_year],
                  [
                    "Subject",
                    r.subject_name
                      ? `${r.subject_code ? `${r.subject_code} — ` : ""}${r.subject_name}`
                      : null,
                  ],
                  ["Department", r.department_name],
                  ["Remarks", r.remarks],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-3 py-2">
                  <dt className="shrink-0 text-muted">{label}</dt>
                  <dd className="min-w-0 break-words text-right text-fg">
                    {value || <span className="text-faint">—</span>}
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
