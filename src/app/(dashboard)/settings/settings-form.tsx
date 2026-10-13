"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, RotateCcw, Boxes } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { AutoGrowTextarea } from "@/components/ui/auto-grow-textarea";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import { apiRequest } from "@/lib/api-client";
import {
  DEFAULT_SETTINGS,
  renderTemplate,
  toHexColor,
  type AppSettings,
} from "@/lib/app-settings";
import BrandAsset from "./brand-asset";

/** One colour field: a native swatch wired to a hex input. */
function ColorField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const valid = !value || !!toHexColor(value);
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          // The native picker only understands #rrggbb, so give it a fallback
          // while the text input holds a half-typed value.
          value={toHexColor(value) ?? "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className={`h-9 w-10 shrink-0 cursor-pointer rounded-lg border border-line bg-elevated p-1 ${
            value ? "" : "opacity-40"
          }`}
          aria-label={`${label} colour picker`}
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#4f46e5"
          className={valid ? undefined : "border-red-500"}
        />
      </div>
      <p className={`mt-1 text-xs ${valid ? "text-faint" : "text-red-500"}`}>
        {valid ? hint : "Use a hex colour such as #4f46e5."}
      </p>
    </div>
  );
}

export default function SettingsForm({
  settings,
  settingsId,
}: {
  settings: AppSettings;
  settingsId: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();

  const [form, setForm] = useState({
    project_name: settings.project_name ?? "",
    tab_title: settings.tab_title ?? "",
    tagline: settings.tagline ?? "",
    footer_text: settings.footer_text ?? "",
    footer_credit: settings.footer_credit ?? "",
    letterhead: settings.letterhead ?? "",
    accent_color: settings.accent_color ?? "",
    accent_fg_color: settings.accent_fg_color ?? "",
    sidebar_bg: settings.sidebar_bg ?? "",
    sidebar_text: settings.sidebar_text ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const badColour = (["accent_color", "accent_fg_color", "sidebar_bg", "sidebar_text"] as const).find(
    (k) => form[k] && !toHexColor(form[k])
  );

  const save = async () => {
    setError(null);
    if (!form.project_name.trim()) return setError("Project name is required.");
    if (!form.tab_title.trim()) return setError("Browser tab title is required.");
    if (badColour) return setError("One of the colours is not a valid hex value.");

    setSaving(true);
    const result = await apiRequest("/api/settings", { method: "PUT", body: form });
    setSaving(false);
    if (result.success) {
      toast.success(result.message || "Settings saved");
      router.refresh();
    } else {
      setError(result.message);
      toast.error(result.message);
    }
  };

  const reset = async () => {
    const ok = await confirm({
      title: "Reset to defaults?",
      description: "Branding text and colours go back to the shipped values. Logo and favicon are kept.",
      confirmLabel: "Reset",
      tone: "danger",
    });
    if (!ok) return;
    setSaving(true);
    const result = await apiRequest("/api/settings", { method: "PUT", body: { reset: true } });
    setSaving(false);
    if (toast.fromResult(result)) {
      setForm({
        project_name: DEFAULT_SETTINGS.project_name,
        tab_title: DEFAULT_SETTINGS.tab_title,
        tagline: DEFAULT_SETTINGS.tagline ?? "",
        footer_text: DEFAULT_SETTINGS.footer_text ?? "",
        footer_credit: DEFAULT_SETTINGS.footer_credit ?? "",
        letterhead: "",
        accent_color: DEFAULT_SETTINGS.accent_color ?? "",
        accent_fg_color: DEFAULT_SETTINGS.accent_fg_color ?? "",
        sidebar_bg: "",
        sidebar_text: "",
      });
      router.refresh();
    }
  };

  const previewAccent = toHexColor(form.accent_color) ?? "#818cf8";
  const previewAccentFg = toHexColor(form.accent_fg_color) ?? "#c7d2fe";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-base font-semibold text-fg">Application Settings</h1>
          <p className="text-sm text-muted">
            Branding and colours shown across the app. Stored as a single row in{" "}
            <code className="rounded bg-elevated px-1 py-0.5 text-xs">
              application_settings_master_t
            </code>
            .
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={reset} disabled={saving}>
            <RotateCcw className="h-4 w-4" /> Reset defaults
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save settings"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500 ring-1 ring-red-500/20">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Branding</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>
                  Project name <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={form.project_name}
                  onChange={(e) => set({ project_name: e.target.value })}
                />
                <p className="mt-1 text-xs text-faint">Shown in the sidebar header.</p>
              </div>
              <div>
                <Label>
                  Browser tab title <span className="text-red-500">*</span>
                </Label>
                <Input value={form.tab_title} onChange={(e) => set({ tab_title: e.target.value })} />
                <p className="mt-1 text-xs text-faint">Shown in the browser tab and metadata.</p>
              </div>
              <div className="sm:col-span-2">
                <Label>Tagline</Label>
                <Input value={form.tagline} onChange={(e) => set({ tagline: e.target.value })} />
                <p className="mt-1 text-xs text-faint">Optional subtitle under the project name.</p>
              </div>
              <div>
                <Label>Footer text</Label>
                <Input
                  value={form.footer_text}
                  onChange={(e) => set({ footer_text: e.target.value })}
                />
                <p className="mt-1 text-xs text-faint">
                  Use <code className="rounded bg-elevated px-1">{"{year}"}</code> to insert the
                  current year.
                </p>
              </div>
              <div>
                <Label>Footer credit</Label>
                <Input
                  value={form.footer_credit}
                  onChange={(e) => set({ footer_credit: e.target.value })}
                />
                <p className="mt-1 text-xs text-faint">Shown after the copyright notice.</p>
              </div>
              <div className="sm:col-span-2">
                <Label>Letterhead</Label>
                <AutoGrowTextarea
                  rows={3}
                  value={form.letterhead}
                  onChange={(e) => set({ letterhead: e.target.value })}
                  placeholder={"Government Polytechnic College Nedumkandam\nIdukki, Kerala — 685553"}
                  className="w-full rounded-lg border border-line bg-elevated px-3 py-2 text-sm text-fg outline-none placeholder:text-faint focus:border-accent"
                />
                <p className="mt-1 text-xs text-faint">
                  Available to printed sheets — the address and reference lines, one per line.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 border-t border-line pt-4 sm:grid-cols-2">
              <BrandAsset
                label="Logo"
                hint="PNG, JPG, WebP or GIF. Max 10 MB."
                category="LOGO"
                settingsId={settingsId}
                currentId={settings.logo_id}
                accept="image/png,image/jpeg,image/webp,image/gif"
              />
              <BrandAsset
                label="Favicon"
                hint="PNG or GIF. Square images look best — 32×32 or 64×64."
                category="FAVICON"
                settingsId={settingsId}
                currentId={settings.favicon_id}
                accept="image/png,image/gif,image/webp"
                square
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Mirrors the sidebar header, so the name and tagline can be judged
                in place rather than imagined. */}
            <div
              className="flex items-center gap-2.5 rounded-xl border border-line p-3"
              style={{
                background: toHexColor(form.sidebar_bg) ?? undefined,
                color: toHexColor(form.sidebar_text) ?? undefined,
              }}
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl text-white"
                style={{ background: previewAccent }}
              >
                {settings.logo_id ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/attachment?id=${settings.logo_id}`}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Boxes className="h-5 w-5" />
                )}
              </span>
              <div className="min-w-0 leading-tight">
                <div className="truncate text-sm font-semibold">
                  {form.project_name || "Project name"}
                </div>
                <div className="truncate text-[11px] opacity-70">{form.tagline}</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <span
                className="rounded-lg px-2.5 py-1 text-xs font-medium"
                style={{ background: previewAccent, color: "#fff" }}
              >
                Accent
              </span>
              <span
                className="rounded-lg px-2.5 py-1 text-xs font-medium"
                style={{ background: `${previewAccent}26`, color: previewAccentFg }}
              >
                Accent soft
              </span>
            </div>

            <div className="rounded-lg border border-line px-3 py-2 text-center text-[11px] text-muted">
              {renderTemplate(form.footer_text) || "Footer text"}{" "}
              <span className="text-fg">{form.footer_credit}</span>
            </div>

            <p className="text-xs text-faint">
              Colours and branding apply across the app as soon as you save.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Colour Palette</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <ColorField
              label="Accent"
              hint="Buttons, links, focus rings"
              value={form.accent_color}
              onChange={(v) => set({ accent_color: v })}
            />
            <ColorField
              label="Accent text"
              hint="Text on soft accent fills"
              value={form.accent_fg_color}
              onChange={(v) => set({ accent_fg_color: v })}
            />
            <ColorField
              label="Sidebar background"
              hint="Left nav surface — blank follows the theme"
              value={form.sidebar_bg}
              onChange={(v) => set({ sidebar_bg: v })}
            />
            <ColorField
              label="Sidebar text"
              hint="Sidebar heading colour — blank follows the theme"
              value={form.sidebar_text}
              onChange={(v) => set({ sidebar_text: v })}
            />
          </div>
          <p className="mt-3 text-xs text-faint">
            Leave the sidebar colours blank to keep the dark/light theme defaults. Surfaces, text and
            borders stay theme-driven either way.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
