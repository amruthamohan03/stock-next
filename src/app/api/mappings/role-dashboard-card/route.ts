import { NextResponse, type NextRequest } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { getSession } from "@/lib/session";
import { dashboardCardMasterT, menuMasterT, roleDashboardCardMappingT } from "@/db/schema";

// Ports RoleDashboardCardController — load/save which dashboard cards a role sees.

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const roleId = Number(new URL(req.url).searchParams.get("role_id"));
  if (!roleId) return NextResponse.json({ success: false, message: "Invalid role" }, { status: 400 });

  const [cards, menus, maps] = await Promise.all([
    db
      .select()
      .from(dashboardCardMasterT)
      .where(eq(dashboardCardMasterT.display, "Y"))
      .orderBy(asc(dashboardCardMasterT.card_category), asc(dashboardCardMasterT.card_order)),
    db.select({ id: menuMasterT.id, menu_name: menuMasterT.menu_name }).from(menuMasterT),
    db
      .select({ card_id: roleDashboardCardMappingT.card_id })
      .from(roleDashboardCardMappingT)
      .where(eq(roleDashboardCardMappingT.role_id, roleId)),
  ]);

  const menuById = new Map(menus.map((m) => [m.id, m.menu_name]));
  const mapped = new Set(maps.map((m) => m.card_id));

  const data = cards.map((c) => ({
    card_id: c.id,
    card_key: c.card_key,
    card_title: c.card_title,
    card_subtitle: c.card_subtitle,
    card_icon: c.card_icon,
    card_color: c.card_color,
    card_category: c.card_category,
    menu_id: c.menu_id,
    menu_name: (c.menu_id && menuById.get(c.menu_id)) || "Unassigned",
    is_mapped: mapped.has(c.id) ? 1 : 0,
  }));

  return NextResponse.json({ success: true, data });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    action?: string;
    role_id?: number;
    card_ids?: number[];
    source_role_id?: number;
    target_role_id?: number;
  };

  try {
    // ---- Copy all mappings from one role to another ----
    if (body.action === "copy") {
      const source = Number(body.source_role_id);
      const target = Number(body.target_role_id);
      if (!source || !target)
        return NextResponse.json({ success: false, message: "Invalid role selection" }, { status: 400 });
      if (source === target)
        return NextResponse.json(
          { success: false, message: "Source and target roles cannot be the same" },
          { status: 400 }
        );

      const src = await db
        .select()
        .from(roleDashboardCardMappingT)
        .where(eq(roleDashboardCardMappingT.role_id, source));

      await db.transaction(async (tx) => {
        await tx.delete(roleDashboardCardMappingT).where(eq(roleDashboardCardMappingT.role_id, target));
        if (src.length) {
          await tx.insert(roleDashboardCardMappingT).values(
            src.map((m) => ({
              role_id: target,
              card_id: m.card_id,
              menu_id: m.menu_id,
              is_visible: m.is_visible,
              card_order: m.card_order,
              created_by: session.id,
            }))
          );
        }
      });
      return NextResponse.json({ success: true, message: "Mapping copied successfully" });
    }

    // ---- Save mapping for a role ----
    const roleId = Number(body.role_id);
    if (!roleId) return NextResponse.json({ success: false, message: "Invalid role" }, { status: 400 });

    const cardIds = (body.card_ids ?? []).map(Number).filter((n) => n > 0);

    // Resolve each card's menu_id so the mapping row carries the right page.
    const menuByCard = new Map(
      (await db
        .select({ id: dashboardCardMasterT.id, menu_id: dashboardCardMasterT.menu_id })
        .from(dashboardCardMasterT)).map((c) => [c.id, c.menu_id])
    );

    await db.transaction(async (tx) => {
      await tx.delete(roleDashboardCardMappingT).where(eq(roleDashboardCardMappingT.role_id, roleId));
      if (cardIds.length) {
        await tx.insert(roleDashboardCardMappingT).values(
          cardIds.map((cardId, i) => ({
            role_id: roleId,
            card_id: cardId,
            menu_id: menuByCard.get(cardId) ?? 0,
            is_visible: 1,
            card_order: i + 1,
            created_by: session.id,
          }))
        );
      }
    });
    return NextResponse.json({
      success: true,
      message: "Dashboard card mapping saved successfully",
      mapped_count: cardIds.length,
    });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}
