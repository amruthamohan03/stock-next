import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { applicationSettingsMasterT, attachmentT } from "@/db/schema";
import { DEFAULT_SETTINGS, type AppSettings } from "@/lib/app-settings";

/** The settings row is a singleton — always this id. */
export const SETTINGS_ID = 1;

/**
 * Read the settings, creating the row on first use so the app works before
 * anyone opens the settings page. Falls back to the defaults if the table is
 * somehow unreachable, because branding must never take the whole app down.
 */
export async function getAppSettings(): Promise<AppSettings> {
  try {
    let [row] = await db
      .select()
      .from(applicationSettingsMasterT)
      .where(eq(applicationSettingsMasterT.id, SETTINGS_ID))
      .limit(1);

    if (!row) {
      [row] = await db
        .insert(applicationSettingsMasterT)
        .values({ id: SETTINGS_ID })
        .onConflictDoNothing()
        .returning();
      // A concurrent request may have won the insert; read it back.
      if (!row) {
        [row] = await db
          .select()
          .from(applicationSettingsMasterT)
          .where(eq(applicationSettingsMasterT.id, SETTINGS_ID))
          .limit(1);
      }
    }
    if (!row) return DEFAULT_SETTINGS;

    // Logo and favicon are attachment rows, newest of each category wins.
    const assets = await db
      .select({ id: attachmentT.id, category: attachmentT.category })
      .from(attachmentT)
      .where(
        and(
          eq(attachmentT.owner_type, "SETTINGS"),
          eq(attachmentT.owner_id, SETTINGS_ID),
          eq(attachmentT.display, "Y")
        )
      );
    const newest = (category: string) =>
      assets.filter((a) => a.category === category).map((a) => a.id).sort((a, b) => b - a)[0] ?? null;

    return {
      project_name: row.project_name,
      tab_title: row.tab_title,
      tagline: row.tagline,
      footer_text: row.footer_text,
      footer_credit: row.footer_credit,
      letterhead: row.letterhead,
      accent_color: row.accent_color,
      accent_fg_color: row.accent_fg_color,
      sidebar_bg: row.sidebar_bg,
      sidebar_text: row.sidebar_text,
      logo_id: newest("LOGO"),
      favicon_id: newest("FAVICON"),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}
