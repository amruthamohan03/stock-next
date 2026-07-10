import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { menuMasterT, roleMenuMappingT } from "@/db/schema";

export type MenuNode = {
  id: number;
  parentId: number | null;
  level: number;
  text: string;
  url: string | null;
  icon: string | null;
  order: number;
  children: MenuNode[];
  perms: { view: boolean; add: boolean; edit: boolean; delete: boolean; approve: boolean };
};

/**
 * Build the sidebar menu for a role, honouring role_menu_mapping_t permissions.
 * Super Admin (role_id = 1) sees every active menu.
 */
export async function getMenuForRole(roleId: number): Promise<MenuNode[]> {
  const allMenus = await db
    .select()
    .from(menuMasterT)
    .where(eq(menuMasterT.display, "Y"));

  const isSuperAdmin = roleId === 1;

  const mappings = isSuperAdmin
    ? []
    : await db
        .select()
        .from(roleMenuMappingT)
        .where(
          and(
            eq(roleMenuMappingT.role_id, roleId),
            eq(roleMenuMappingT.can_view, 1)
          )
        );

  const permByMenu = new Map<number, MenuNode["perms"]>();
  for (const m of mappings) {
    permByMenu.set(Number(m.menu_id), {
      view: !!m.can_view,
      add: !!m.can_add,
      edit: !!m.can_edit,
      delete: !!m.can_delete,
      approve: !!m.can_approve,
    });
  }

  const allowed = (id: number) =>
    isSuperAdmin ? true : permByMenu.has(id);

  const nodes = new Map<number, MenuNode>();
  for (const m of allMenus) {
    nodes.set(m.id, {
      id: m.id,
      parentId: m.menu_id ?? null,
      level: m.menu_level ?? 0,
      text: m.text ?? m.menu_name ?? "",
      url: m.url ?? null,
      icon: m.icon?.trim() || null,
      order: m.menu_order ?? 1,
      children: [],
      perms:
        permByMenu.get(m.id) ??
        { view: isSuperAdmin, add: isSuperAdmin, edit: isSuperAdmin, delete: isSuperAdmin, approve: isSuperAdmin },
    });
  }

  // Top-level items are menu_level === 0 (mirrors the PHP MenuModel); everything
  // else nests under its menu_id parent.
  const roots: MenuNode[] = [];
  for (const node of nodes.values()) {
    if (node.level === 0) {
      roots.push(node);
    } else if (node.parentId && nodes.has(node.parentId)) {
      nodes.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Keep a branch only if the top item itself is allowed, or any child is.
  const prune = (list: MenuNode[]): MenuNode[] =>
    list
      .map((n) => ({ ...n, children: prune(n.children) }))
      .filter((n) => {
        const selfOk = n.url && n.url !== "#" ? allowed(n.id) : false;
        return selfOk || n.children.length > 0 || (isSuperAdmin && (!n.url || n.url === "#"));
      })
      .sort((a, b) => a.order - b.order);

  return prune(roots);
}

/** Does this role have a given permission on a menu (by url slug)? */
export async function hasPermission(
  roleId: number,
  menuUrls: string[],
  action: "view" | "add" | "edit" | "delete" | "approve" = "view"
): Promise<boolean> {
  if (roleId === 1) return true;
  const menus = await db
    .select({ id: menuMasterT.id })
    .from(menuMasterT)
    .where(inArray(menuMasterT.url, menuUrls));
  if (menus.length === 0) return false;
  const rows = await db
    .select()
    .from(roleMenuMappingT)
    .where(
      and(
        eq(roleMenuMappingT.role_id, roleId),
        inArray(
          roleMenuMappingT.menu_id,
          menus.map((m) => m.id)
        )
      )
    );
  const col = `can_${action}` as const;
  return rows.some((r) => !!(r as Record<string, unknown>)[col]);
}
