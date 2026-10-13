import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { getAppSettings, SETTINGS_ID } from "@/lib/app-settings-queries";
import SettingsForm from "./settings-form";

// Application branding and palette. Super Admin only — the menu hides it from
// other roles, and /api/settings refuses them too, so this is belt and braces.
export default async function SettingsPage() {
  const session = await getSession();
  if (session?.roleId !== 1) notFound();

  const settings = await getAppSettings();
  return <SettingsForm settings={settings} settingsId={SETTINGS_ID} />;
}
