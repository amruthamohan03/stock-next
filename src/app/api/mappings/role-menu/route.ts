import { NextResponse, type NextRequest } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { getSession } from "@/lib/session";
import { menuMasterT, roleMenuMappingT } from "@/db/schema";

// Ports RolemenumappingController — load/save the per-menu permission matrix for a role.

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const roleId = Number(new URL(req.url).searchParams.get("role_id"));
  if (!roleId) return NextResponse.json({ success: false, message: "Invalid role" }, { status: 400 });

  const [menus, maps] = await Promise.all([
    db
      .select({ id: menuMasterT.id, menu_name: menuMasterT.menu_name })
      .from(menuMasterT)
      .where(eq(menuMasterT.display, "Y"))
      .orderBy(asc(menuMasterT.menu_level), asc(menuMasterT.menu_order)),
    db.select().from(roleMenuMappingT).where(eq(roleMenuMappingT.role_id, roleId)),
  ]);

  const byMenu = new Map(maps.map((m) => [Number(m.menu_id), m]));
  const data = menus.map((m) => {
    const p = byMenu.get(m.id);
    return {
      menu_id: m.id,
      menu_name: m.menu_name ?? `#${m.id}`,
      can_view: p?.can_view ?? 0,
      can_add: p?.can_add ?? 0,
      can_edit: p?.can_edit ?? 0,
      can_delete: p?.can_delete ?? 0,
      can_approve: p?.can_approve ?? 0,
    };
  });

  return NextResponse.json({ success: true, data });
}

type PermRow = {
  menu_id: number;
  view?: boolean;
  add?: boolean;
  edit?: boolean;
  delete?: boolean;
  approve?: boolean;
};

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { role_id?: number; rows?: PermRow[] };
  const roleId = Number(body.role_id);
  if (!roleId) return NextResponse.json({ success: false, message: "Invalid role" }, { status: 400 });

  // Only persist menus that have at least one permission (mirrors the PHP behaviour).
  const rows = (body.rows ?? []).filter(
    (r) => r.view || r.add || r.edit || r.delete || r.approve
  );

  try {
    await db.transaction(async (tx) => {
      await tx.delete(roleMenuMappingT).where(eq(roleMenuMappingT.role_id, roleId));
      if (rows.length) {
        await tx.insert(roleMenuMappingT).values(
          rows.map((r) => ({
            role_id: roleId,
            menu_id: Number(r.menu_id),
            can_view: r.view ? 1 : 0,
            can_add: r.add ? 1 : 0,
            can_edit: r.edit ? 1 : 0,
            can_delete: r.delete ? 1 : 0,
            can_approve: r.approve ? 1 : 0,
            created_by: session.id,
          }))
        );
      }
    });
    return NextResponse.json({ success: true, message: "Role-Menu mapping saved successfully" });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}
