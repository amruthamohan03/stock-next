import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { committeeT } from "@/db/schema";

/**
 * Server-only committee queries.
 *
 * Kept apart from `committee.ts` because that module is imported by client
 * components for its labels and tints — pulling the `db` client in alongside
 * them drags postgres.js into the browser bundle and the build fails on
 * `Can't resolve 'fs'`.
 */

/** Active committees as dropdown options — used by the event pages. */
export async function getCommitteeOptions() {
  const rows = await db
    .select({ id: committeeT.id, name: committeeT.name, year: committeeT.academic_year })
    .from(committeeT)
    .where(eq(committeeT.display, "Y"))
    .orderBy(asc(committeeT.name));
  return rows.map((r) => ({
    value: String(r.id),
    label: r.year ? `${r.name} (${r.year})` : r.name,
  }));
}
