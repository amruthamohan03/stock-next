"use client";

import Link from "next/link";
import {
  CalendarDays,
  ListChecks,
  Users,
  Paperclip,
  MapPin,
  Lock,
  ArrowRight,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { eventStatusLabel, isEventLocked } from "@/lib/event-status";
import type { EventRow } from "./event-list";

/** One festival as a card — status, dates, and the size of the programme. */
export default function EventCard({ row }: { row: EventRow }) {
  const locked = isEventLocked(row.status);
  // Finalised events read as "done" (green); open ones are still in progress.
  const grad = locked ? "grad-green" : "grad-blue";

  const meta = (icon: React.ReactNode, value: string, muted = false) => (
    <span className={`inline-flex items-center gap-1 ${muted ? "text-faint" : "text-muted"}`}>
      {icon}
      {value}
    </span>
  );

  return (
    <Link
      href={`/event/${row.id}`}
      className="group block overflow-hidden rounded-2xl border border-line bg-card transition-all hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-lg"
    >
      <div className={`${grad} relative p-4 text-white`}>
        <div className="flex items-start justify-between gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-medium backdrop-blur-sm">
            {locked && <Lock className="h-3 w-3" />}
            {eventStatusLabel(row.status)}
          </span>
          {row.academic_year && (
            <span className="text-[11px] text-white/85">{row.academic_year}</span>
          )}
        </div>
        <h3 className="mt-2 line-clamp-2 text-base font-bold leading-snug">
          {row.name || "Untitled event"}
        </h3>
        {row.subtitle && (
          <p className="mt-0.5 line-clamp-1 text-xs text-white/80">{row.subtitle}</p>
        )}
      </div>

      <div className="space-y-3 p-4">
        <div className="space-y-1.5 text-sm">
          <div className="flex items-center gap-2 text-muted">
            <CalendarDays className="h-4 w-4 shrink-0 text-accent" />
            <span className="truncate">
              {row.start_date ? formatDate(row.start_date) : "Dates not set"}
              {row.end_date && String(row.end_date) !== String(row.start_date)
                ? ` – ${formatDate(row.end_date)}`
                : ""}
            </span>
          </div>
          {row.venue && (
            <div className="flex items-center gap-2 text-muted">
              <MapPin className="h-4 w-4 shrink-0 text-accent" />
              <span className="truncate">{row.venue}</span>
            </div>
          )}
          {row.committee_name && (
            <div className="truncate text-xs text-faint">{row.committee_name}</div>
          )}
        </div>

        {/* On-stage vs off-stage split, so the programme's shape is visible. */}
        {row.item_count > 0 && (
          <div className="flex h-1.5 overflow-hidden rounded-full bg-elevated">
            <div
              className="bg-sky-500"
              style={{ width: `${(row.on_stage_count / row.item_count) * 100}%` }}
              title={`${row.on_stage_count} on stage`}
            />
            <div
              className="bg-amber-500"
              style={{ width: `${(row.off_stage_count / row.item_count) * 100}%` }}
              title={`${row.off_stage_count} off stage`}
            />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-3 text-xs">
          {meta(<ListChecks className="h-3.5 w-3.5" />, `${row.item_count} items`)}
          {meta(<Users className="h-3.5 w-3.5" />, `${row.participant_count}`)}
          {meta(<Paperclip className="h-3.5 w-3.5" />, `${row.file_count}`, !row.file_count)}
          <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
        </div>
      </div>
    </Link>
  );
}
