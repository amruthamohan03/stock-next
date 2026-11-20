import { NextResponse } from "next/server";
import { getSession, type SessionUser } from "@/lib/session";
import { hasPermission } from "@/lib/rbac";

/** Server-only helpers shared by the income tax route handlers. */
export const INCOME_TAX_MENU = ["income-tax"];

export const reply = (status: number, message: string, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ success: status < 400, message, ...extra }, { status });

const VERB = {
  view: "use",
  add: "add",
  edit: "edit",
  delete: "delete",
  approve: "lock or unlock",
} as const;

/** Session + RBAC in one step; returns the user or the response to send. */
export async function authorise(
  action: keyof typeof VERB,
  what = "income tax statements"
): Promise<SessionUser | NextResponse> {
  const session = await getSession();
  if (!session) return reply(401, "Your session has expired. Please sign in again.");
  if (!(await hasPermission(session.roleId, INCOME_TAX_MENU, action)))
    return reply(403, `You do not have permission to ${VERB[action]} ${what}.`);
  return session;
}
