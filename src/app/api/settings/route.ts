import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { getSession } from "@/lib/session";
import { applicationSettingsMasterT } from "@/db/schema";
import { DEFAULT_SETTINGS, toHexColor } from "@/lib/app-settings";
import { SETTINGS_ID } from "@/lib/app-settings-queries";

/**
 * Application branding and palette — a single row, so there is only an update.
 *
 * Changing how the whole app looks is an administrator's job: `role_id === 1`
 * only, matching the god-mode rule used across auth/RBAC/menu. The menu
 * mapping hides the page from everyone else, but the check lives here too, so
 * the API cannot be called around it.
 */

type Body = {
  project_name?: string;
  tab_title?: string;
  tagline?: string;
  footer_text?: string;
  footer_credit?: string;
  letterhead?: string;
  accent_color?: string;
  accent_fg_color?: string;
  sidebar_bg?: string;
  sidebar_text?: string;
  /** Put every field back to its shipped default. */
  reset?: boolean;
};

const str = (v: unknown, max: number) => {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, max) : null;
};

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (session.roleId !== 1) {
    return NextResponse.json(
      { success: false, message: "Only a Super Admin can change the application settings." },
      { status: 403 }
    );
  }

  const body = (await req.json()) as Body;

  if (body.reset) {
    try {
      await db
        .update(applicationSettingsMasterT)
        .set({
          project_name: DEFAULT_SETTINGS.project_name,
          tab_title: DEFAULT_SETTINGS.tab_title,
          tagline: DEFAULT_SETTINGS.tagline,
          footer_text: DEFAULT_SETTINGS.footer_text,
          footer_credit: DEFAULT_SETTINGS.footer_credit,
          letterhead: null,
          accent_color: DEFAULT_SETTINGS.accent_color,
          accent_fg_color: DEFAULT_SETTINGS.accent_fg_color,
          sidebar_bg: null,
          sidebar_text: null,
          updated_by: session.id,
          updated_at: new Date(),
        })
        .where(eq(applicationSettingsMasterT.id, SETTINGS_ID));
      return NextResponse.json({ success: true, message: "Settings reset to defaults" });
    } catch (e) {
      return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
    }
  }

  const project_name = str(body.project_name, 100);
  const tab_title = str(body.tab_title, 100);
  if (!project_name) {
    return NextResponse.json({ success: false, message: "Project name is required" }, { status: 400 });
  }
  if (!tab_title) {
    return NextResponse.json({ success: false, message: "Browser tab title is required" }, { status: 400 });
  }

  // Colours are the one input that ends up inside a <style> tag, so a value
  // that is not a plain hex literal is rejected outright rather than stored.
  const colours: Record<string, string | null> = {};
  for (const key of ["accent_color", "accent_fg_color", "sidebar_bg", "sidebar_text"] as const) {
    const raw = String(body[key] ?? "").trim();
    if (!raw) {
      colours[key] = null;
      continue;
    }
    const hex = toHexColor(raw);
    if (!hex) {
      return NextResponse.json(
        { success: false, message: `"${raw}" is not a valid hex colour (use #rrggbb).` },
        { status: 400 }
      );
    }
    colours[key] = hex;
  }

  try {
    await db
      .update(applicationSettingsMasterT)
      .set({
        project_name,
        tab_title,
        tagline: str(body.tagline, 150),
        footer_text: str(body.footer_text, 255),
        footer_credit: str(body.footer_credit, 255),
        letterhead: String(body.letterhead ?? "").trim() || null,
        accent_color: colours.accent_color,
        accent_fg_color: colours.accent_fg_color,
        sidebar_bg: colours.sidebar_bg,
        sidebar_text: colours.sidebar_text,
        updated_by: session.id,
        updated_at: new Date(),
      })
      .where(eq(applicationSettingsMasterT.id, SETTINGS_ID));

    return NextResponse.json({ success: true, message: "Settings saved" });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}
