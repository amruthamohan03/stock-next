import { NextResponse, type NextRequest } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { getSession } from "@/lib/session";
import { groupItemNameMasterT, itemMasterT } from "@/db/schema";

/**
 * Item ↔ Item Group mapping.
 *
 * An item carries a single `group_id`, so one mapping is a plain update — but
 * the screen assigns a whole selection at once, which through the generic
 * masters route would be one request per row. This does it in one statement.
 *
 * A blank/0/null `group_id` clears the group, which is how an item goes back to
 * "Ungrouped".
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { group_id?: number | string | null; item_ids?: number[] };

  const itemIds = [...new Set((body.item_ids ?? []).map(Number))].filter(
    (id) => Number.isInteger(id) && id > 0
  );
  if (itemIds.length === 0) {
    return NextResponse.json(
      { success: false, message: "Select at least one item to map." },
      { status: 400 }
    );
  }

  const raw = Number(body.group_id);
  const groupId = Number.isInteger(raw) && raw > 0 ? raw : null;

  let groupName = "";
  if (groupId !== null) {
    const [group] = await db
      .select({ name: groupItemNameMasterT.group_name })
      .from(groupItemNameMasterT)
      .where(eq(groupItemNameMasterT.id, groupId))
      .limit(1);
    if (!group) {
      return NextResponse.json(
        { success: false, message: "That item group no longer exists." },
        { status: 404 }
      );
    }
    groupName = group.name;
  }

  try {
    const updated = await db
      .update(itemMasterT)
      .set({ group_id: groupId, updated_by: session.id, updated_at: new Date() })
      .where(inArray(itemMasterT.id, itemIds))
      .returning({ id: itemMasterT.id });

    const n = `${updated.length} item${updated.length === 1 ? "" : "s"}`;
    return NextResponse.json({
      success: true,
      message: groupId === null ? `Group cleared on ${n}.` : `${n} mapped to “${groupName}”.`,
    });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}
