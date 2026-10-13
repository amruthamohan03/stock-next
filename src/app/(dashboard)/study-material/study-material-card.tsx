"use client";

import Link from "next/link";
import { BookOpen, Paperclip, GraduationCap, CalendarDays, ArrowRight, User } from "lucide-react";
import {
  MATERIAL_TYPE_GRAD,
  MATERIAL_TYPE_SHORT,
  detailFieldFor,
  toMaterialType,
} from "@/lib/study-material";
import type { MaterialRow } from "./study-material-list";

/** One study material as a card — type-coloured header, then where it belongs. */
export default function StudyMaterialCard({ row }: { row: MaterialRow }) {
  const type = toMaterialType(row.material_type);
  const grad = MATERIAL_TYPE_GRAD[type];
  // Question papers show their exam session; notes show the module.
  const detailKey = detailFieldFor(type);
  const detail = detailKey === "exam_session" ? row.exam_session : row.module_no;

  return (
    <Link
      href={`/study-material/${row.id}`}
      className="group block overflow-hidden rounded-2xl border border-line bg-card transition-all hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-lg"
    >
      <div className={`${grad} relative p-4 text-white`}>
        <div className="flex items-start justify-between gap-2">
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-medium backdrop-blur-sm">
            {MATERIAL_TYPE_SHORT[type]}
          </span>
          {row.semester && (
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-medium backdrop-blur-sm">
              {row.semester}
            </span>
          )}
        </div>
        <h3 className="mt-2 line-clamp-2 text-base font-bold leading-snug">
          {row.title || "Untitled"}
        </h3>
        {detail && <p className="mt-0.5 text-xs text-white/85">{detail}</p>}
      </div>

      <div className="space-y-2.5 p-4">
        <div className="space-y-1.5 text-sm">
          <div className="flex items-center gap-2 text-muted">
            <BookOpen className="h-4 w-4 shrink-0 text-accent" />
            <span className="truncate">
              {row.subject_name
                ? `${row.subject_code ? `${row.subject_code} — ` : ""}${row.subject_name}`
                : "No subject set"}
            </span>
          </div>
          {row.department_name && (
            <div className="flex items-center gap-2 text-muted">
              <GraduationCap className="h-4 w-4 shrink-0 text-accent" />
              <span className="truncate">{row.department_name}</span>
            </div>
          )}
          {row.uploader_name && (
            <div className="flex items-center gap-2 text-faint">
              <User className="h-4 w-4 shrink-0" />
              <span className="truncate">{row.uploader_name}</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-3 text-xs">
          <span
            className={`inline-flex items-center gap-1 ${row.file_count ? "text-muted" : "text-faint"}`}
            title={`${row.file_count} file${row.file_count === 1 ? "" : "s"}`}
          >
            <Paperclip className="h-3.5 w-3.5" /> {row.file_count}
          </span>
          {row.academic_year && (
            <span className="inline-flex items-center gap-1 text-muted">
              <CalendarDays className="h-3.5 w-3.5" /> {row.academic_year}
            </span>
          )}
          {row.scheme && <span className="truncate text-faint">{row.scheme}</span>}
          <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
        </div>
      </div>
    </Link>
  );
}
