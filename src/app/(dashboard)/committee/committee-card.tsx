"use client";

import Link from "next/link";
import { Users, Paperclip, ScrollText, ArrowRight, CalendarDays } from "lucide-react";
import { formatDate } from "@/lib/utils";
import {
  COMMITTEE_TYPE_GRAD,
  COMMITTEE_TYPE_LABEL,
  MEMBER_ROLE_LABEL,
  MEMBER_ROLE_TINT,
  initialsOf,
  toMemberRole,
} from "@/lib/committee";
import type { CommitteeRow } from "./committee-list";

/** One committee as a card: a coloured header by type, then who and what's in it. */
export default function CommitteeCard({ row }: { row: CommitteeRow }) {
  const type = row.committee_type ?? "OTHER";
  const grad = COMMITTEE_TYPE_GRAD[type] ?? "grad-cyan";
  // Prefer the convenor as the committee's face; fall back to the chairman.
  const lead = row.convenor ?? row.chairman;
  const leadRole = row.convenor ? "CONVENOR" : "CHAIRMAN";

  return (
    <Link
      href={`/committee/${row.id}`}
      className="group block overflow-hidden rounded-2xl border border-line bg-card transition-all hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-lg"
    >
      <div className={`${grad} relative p-4 text-white`}>
        <div className="flex items-start justify-between gap-2">
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-medium backdrop-blur-sm">
            {COMMITTEE_TYPE_LABEL[type] ?? type}
          </span>
          {row.academic_year && (
            <span className="inline-flex items-center gap-1 text-[11px] text-white/85">
              <CalendarDays className="h-3 w-3" /> {row.academic_year}
            </span>
          )}
        </div>
        <h3 className="mt-2 line-clamp-2 text-base font-bold leading-snug">
          {row.name || "Untitled committee"}
        </h3>
      </div>

      <div className="space-y-3 p-4">
        {lead ? (
          <div className="flex items-center gap-2">
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ring-1 ring-inset ${MEMBER_ROLE_TINT[leadRole]}`}
            >
              {initialsOf(lead)}
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-fg">{lead}</div>
              <div className="text-[11px] text-muted">{MEMBER_ROLE_LABEL[leadRole]}</div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-faint">No convenor named yet</div>
        )}

        {/* A glance at who else is on it. */}
        {row.member_avatars.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {row.member_avatars.slice(0, 5).map((m, i) => (
                <span
                  key={i}
                  title={m.name}
                  className={`flex h-7 w-7 items-center justify-center rounded-full border-2 border-card text-[10px] font-semibold ring-1 ring-inset ${
                    MEMBER_ROLE_TINT[toMemberRole(m.role)]
                  }`}
                >
                  {initialsOf(m.name)}
                </span>
              ))}
            </div>
            {row.member_count > 5 && (
              <span className="text-xs text-muted">+{row.member_count - 5} more</span>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-3 text-xs text-muted">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" /> {row.member_count}
          </span>
          <span
            className={`inline-flex items-center gap-1 ${row.file_count ? "" : "text-faint"}`}
          >
            <Paperclip className="h-3.5 w-3.5" /> {row.file_count}
          </span>
          {row.order_no && (
            <span className="inline-flex min-w-0 items-center gap-1" title={row.order_no}>
              <ScrollText
                className={`h-3.5 w-3.5 shrink-0 ${row.has_order ? "text-accent" : ""}`}
              />
              <span className="truncate">{row.order_no}</span>
            </span>
          )}
          {row.order_date && (
            <span className="whitespace-nowrap">{formatDate(row.order_date)}</span>
          )}
          <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
        </div>
      </div>
    </Link>
  );
}
