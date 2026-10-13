import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import {
  ArrowLeft,
  Pencil,
  BookOpen,
  GraduationCap,
  CalendarDays,
  User,
  Paperclip,
} from "lucide-react";
import { db } from "@/db";
import {
  attachmentT,
  departmentMasterT,
  staffT,
  studyMaterialT,
  subjectMasterT,
} from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AttachmentPanel, { type AttachmentRow } from "@/components/attachment-panel";
import { formatDate } from "@/lib/utils";
import {
  MATERIAL_TYPE_GRAD,
  MATERIAL_TYPE_LABEL,
  detailFieldFor,
  toMaterialType,
} from "@/lib/study-material";

/** A study material: what it is, and the files that make it up. */
export default async function StudyMaterialDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const materialId = Number(id);
  if (!Number.isInteger(materialId) || materialId <= 0) notFound();

  const [rows, fileRows] = await Promise.all([
    db
      .select({
        id: studyMaterialT.id,
        title: studyMaterialT.title,
        material_type: studyMaterialT.material_type,
        semester: studyMaterialT.semester,
        scheme: studyMaterialT.scheme,
        academic_year: studyMaterialT.academic_year,
        exam_session: studyMaterialT.exam_session,
        module_no: studyMaterialT.module_no,
        description: studyMaterialT.description,
        created_at: studyMaterialT.created_at,
        subject_name: subjectMasterT.subject_name,
        subject_code: subjectMasterT.subject_code,
        department_name: departmentMasterT.department_name,
        uploader_name: staffT.staff_name,
      })
      .from(studyMaterialT)
      .leftJoin(subjectMasterT, eq(studyMaterialT.subject_id, subjectMasterT.id))
      .leftJoin(departmentMasterT, eq(studyMaterialT.department_id, departmentMasterT.id))
      .leftJoin(staffT, eq(studyMaterialT.uploaded_by, staffT.id))
      .where(and(eq(studyMaterialT.id, materialId), eq(studyMaterialT.display, "Y")))
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
          eq(attachmentT.owner_type, "MATERIAL"),
          eq(attachmentT.owner_id, materialId),
          eq(attachmentT.display, "Y")
        )
      )
      .orderBy(asc(attachmentT.id)),
  ]);

  const m = rows[0];
  if (!m) notFound();

  const type = toMaterialType(m.material_type);
  const detailKey = detailFieldFor(type);
  const detail = detailKey === "exam_session" ? m.exam_session : m.module_no;

  const files: AttachmentRow[] = fileRows.map((f) => ({
    id: f.id,
    category: f.category ?? "OTHER",
    title: f.title,
    file_name: f.file_name,
    file_type: f.file_type,
    file_size: f.file_size,
    created_at: f.created_at ? String(f.created_at) : null,
  }));

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
      {/* Hero, matching the committee and event pages. */}
      <div className={`${MATERIAL_TYPE_GRAD[type]} relative overflow-hidden rounded-2xl p-6 text-white`}>
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium backdrop-blur-sm">
                {MATERIAL_TYPE_LABEL[type]}
              </span>
              {detail && (
                <span className="inline-flex rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium backdrop-blur-sm">
                  {detail}
                </span>
              )}
            </div>
            <h1 className="truncate text-2xl font-bold">{m.title}</h1>
            {m.description && (
              <p className="mt-1 max-w-2xl text-sm text-white/80">{m.description}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/study-material"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium backdrop-blur-sm transition-colors hover:bg-white/25"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
            <Link
              href={`/study-material/${m.id}/edit`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium backdrop-blur-sm transition-colors hover:bg-white/25"
            >
              <Pencil className="h-4 w-4" /> Edit
            </Link>
          </div>
        </div>

        <div className="relative mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {stat(
            <BookOpen className="h-4 w-4" />,
            "Subject",
            m.subject_code || m.subject_name || "Not set"
          )}
          {stat(
            <GraduationCap className="h-4 w-4" />,
            "Semester",
            [m.semester, m.department_name].filter(Boolean).join(" · ") || "Not set"
          )}
          {stat(<CalendarDays className="h-4 w-4" />, "Academic year", m.academic_year || "—")}
          {stat(
            <Paperclip className="h-4 w-4" />,
            "Files",
            files.length ? String(files.length) : "None yet"
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle>Files</CardTitle>
          </CardHeader>
          <CardContent>
            <AttachmentPanel
              ownerType="MATERIAL"
              ownerId={m.id}
              files={files}
              defaultCategory="MATERIAL"
            />
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-line text-sm">
              {(
                [
                  ["Subject", m.subject_name ? `${m.subject_code ? `${m.subject_code} — ` : ""}${m.subject_name}` : null],
                  ["Department", m.department_name],
                  ["Semester", m.semester],
                  ["Scheme", m.scheme],
                  ["Academic year", m.academic_year],
                  [detailKey === "exam_session" ? "Exam session" : "Module", detail],
                  ["Prepared by", m.uploader_name],
                  ["Added", m.created_at ? formatDate(m.created_at) : null],
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
            {m.uploader_name && (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-faint">
                <User className="h-3.5 w-3.5" /> Prepared by {m.uploader_name}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
