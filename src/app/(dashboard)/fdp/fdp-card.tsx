"use client";

import Link from "next/link";
import {
  Building2,
  CalendarDays,
  Paperclip,
  User,
  ArrowRight,
  Award,
  BookOpen,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { FDP_MODE_GRAD, FDP_MODE_LABEL, durationLabel, toFdpMode, topicList } from "@/lib/fdp";
import type { FdpRow } from "./fdp-list";

/** One FDP as a card — mode-coloured header, then who attended and when. */
export default function FdpCard({ row }: { row: FdpRow }) {
  const mode = toFdpMode(row.mode);
  const days = durationLabel(row.start_date, row.end_date);
  const topics = topicList(row.topics);

  return (
    <Link
      href={`/fdp/${row.id}`}
      className="group block overflow-hidden rounded-2xl border border-line bg-card transition-all hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-lg"
    >
      <div className={`${FDP_MODE_GRAD[mode]} relative p-4 text-white`}>
        <div className="flex items-start justify-between gap-2">
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-medium backdrop-blur-sm">
            {FDP_MODE_LABEL[mode]}
          </span>
          {days && (
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-medium backdrop-blur-sm">
              {days}
            </span>
          )}
        </div>
        <h3 className="mt-2 line-clamp-2 text-base font-bold leading-snug">
          {row.title || "Untitled programme"}
        </h3>
        {row.organizer && (
          <p className="mt-0.5 line-clamp-1 text-xs text-white/85">{row.organizer}</p>
        )}
      </div>

      <div className="space-y-2.5 p-4">
        <div className="space-y-1.5 text-sm">
          <div className="flex items-center gap-2 text-muted">
            <User className="h-4 w-4 shrink-0 text-accent" />
            <span className="truncate">
              {row.faculty_name || row.staff_name || "No faculty recorded"}
            </span>
          </div>
          <div className="flex items-center gap-2 text-muted">
            <CalendarDays className="h-4 w-4 shrink-0 text-accent" />
            <span className="truncate">
              {row.start_date ? formatDate(row.start_date) : "Dates not set"}
              {row.end_date && String(row.end_date) !== String(row.start_date)
                ? ` – ${formatDate(row.end_date)}`
                : ""}
            </span>
          </div>
          {row.subject_name && (
            <div className="flex items-center gap-2 text-muted">
              <BookOpen className="h-4 w-4 shrink-0 text-accent" />
              <span className="truncate">{row.subject_name}</span>
            </div>
          )}
          {row.department_name && (
            <div className="flex items-center gap-2 text-faint">
              <Building2 className="h-4 w-4 shrink-0" />
              <span className="truncate">{row.department_name}</span>
            </div>
          )}
        </div>

        {topics.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {topics.slice(0, 3).map((t, i) => (
              <span
                key={i}
                className="max-w-full truncate rounded-full bg-elevated px-2 py-0.5 text-[11px] text-muted ring-1 ring-inset ring-line"
                title={t}
              >
                {t}
              </span>
            ))}
            {topics.length > 3 && (
              <span className="px-1 text-[11px] text-faint">+{topics.length - 3}</span>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-3 text-xs">
          <span
            className={`inline-flex items-center gap-1 ${row.file_count ? "text-muted" : "text-faint"}`}
          >
            <Paperclip className="h-3.5 w-3.5" /> {row.file_count}
          </span>
          {row.has_certificate && (
            <span className="inline-flex items-center gap-1 text-amber-500" title="Certificate uploaded">
              <Award className="h-3.5 w-3.5" /> Certificate
            </span>
          )}
          {row.academic_year && <span className="text-muted">{row.academic_year}</span>}
          <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
        </div>
      </div>
    </Link>
  );
}
