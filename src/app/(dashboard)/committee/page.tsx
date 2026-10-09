import Link from "next/link";
import { and, desc, eq, sql } from "drizzle-orm";
import { Plus, CalendarDays } from "lucide-react";
import { db } from "@/db";
import { attachmentT, committeeMemberT, committeeT } from "@/db/schema";
import { buttonClasses } from "@/components/ui/button";
import CommitteeList from "./committee-list";

// Committees constituted in the institution.
export default async function CommitteePage() {
  const rows = await db
    .select({
      id: committeeT.id,
      name: committeeT.name,
      committee_type: committeeT.committee_type,
      academic_year: committeeT.academic_year,
      order_no: committeeT.order_no,
      order_date: committeeT.order_date,
      // Two one-to-many joins multiply each other's rows, so every aggregate
      // here counts DISTINCT ids — otherwise members would be multiplied by
      // files and vice versa.
      member_count: sql<number>`count(distinct ${committeeMemberT.id})::int`,
      file_count: sql<number>`count(distinct ${attachmentT.id})::int`,
      has_order: sql<boolean>`coalesce(bool_or(${attachmentT.category} = 'ORDER'), false)`,
      // Who leads the committee, surfaced on the list so the owner is visible
      // without opening each one. Convenor and chairman are kept apart: a single
      // min() across both roles would label whichever name sorted first as
      // "Convenor", even when it is the chairman.
      convenor: sql<string | null>`min(${committeeMemberT.member_name}) filter (
        where ${committeeMemberT.member_role} = 'CONVENOR'
      )`,
      chairman: sql<string | null>`min(${committeeMemberT.member_name}) filter (
        where ${committeeMemberT.member_role} = 'CHAIRMAN'
      )`,
      // A handful of members for the card's avatar stack, gathered in the same
      // aggregate rather than a follow-up query per committee.
      member_avatars: sql<{ name: string; role: string }[]>`coalesce(
        (array_agg(
           distinct jsonb_build_object(
             'name', ${committeeMemberT.member_name},
             'role', ${committeeMemberT.member_role}
           )
         ) filter (where ${committeeMemberT.id} is not null)
        )[1:6], '{}'
      )`,
    })
    .from(committeeT)
    .leftJoin(
      committeeMemberT,
      and(
        eq(committeeMemberT.committee_id, committeeT.id),
        eq(committeeMemberT.display, "Y")
      )
    )
    .leftJoin(
      attachmentT,
      and(
        eq(attachmentT.owner_type, "COMMITTEE"),
        eq(attachmentT.owner_id, committeeT.id),
        eq(attachmentT.display, "Y")
      )
    )
    .where(eq(committeeT.display, "Y"))
    .groupBy(committeeT.id)
    .orderBy(desc(committeeT.id));

  return (
    <CommitteeList
      rows={rows}
      actions={
        <>
          <Link href="/event" className={buttonClasses({ variant: "outline", size: "sm" })}>
            <CalendarDays className="h-4 w-4" /> Events
          </Link>
          <Link href="/committee/new" className={buttonClasses({ size: "sm" })}>
            <Plus className="h-4 w-4" /> New
          </Link>
        </>
      }
    />
  );
}
