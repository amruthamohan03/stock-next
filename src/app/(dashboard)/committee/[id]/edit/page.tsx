import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { committeeT } from "@/db/schema";
import CommitteeForm, { type CommitteeInitial } from "../../committee-form";

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export default async function EditCommitteePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const committeeId = Number(id);
  if (!Number.isInteger(committeeId) || committeeId <= 0) notFound();

  const [c] = await db
    .select()
    .from(committeeT)
    .where(and(eq(committeeT.id, committeeId), eq(committeeT.display, "Y")))
    .limit(1);
  if (!c) notFound();

  const initial: CommitteeInitial = {
    id: c.id,
    name: s(c.name),
    committee_type: c.committee_type ?? "ARTS",
    academic_year: s(c.academic_year),
    description: s(c.description),
    order_no: s(c.order_no),
    order_date: s(c.order_date),
  };

  return <CommitteeForm initial={initial} />;
}
