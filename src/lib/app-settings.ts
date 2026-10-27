/**
 * Application settings — branding and palette shown across the app.
 *
 * Client-safe: no `db` import, so client components can take these values and
 * the defaults without dragging postgres.js into the browser bundle. The
 * server loader lives in `app-settings-queries.ts`.
 */

export type AppSettings = {
  project_name: string;
  tab_title: string;
  tagline: string | null;
  footer_text: string | null;
  footer_credit: string | null;
  letterhead: string | null;
  accent_color: string | null;
  accent_fg_color: string | null;
  sidebar_bg: string | null;
  sidebar_text: string | null;
  logo_id: number | null;
  favicon_id: number | null;
};

/** What the app looks like before anyone edits the settings. */
export const DEFAULT_SETTINGS: AppSettings = {
  project_name: "Stock",
  tab_title: "Stock Management",
  tagline: "Inventory System",
  footer_text: "© {year} GPTCN Admin · All rights reserved.",
  footer_credit: "Designed by Department of Computer Engineering",
  letterhead: null,
  // Matches the --accent / --accent-fg tokens in globals.css.
  accent_color: "#818cf8",
  accent_fg_color: "#c7d2fe",
  sidebar_bg: null,
  sidebar_text: null,
  logo_id: null,
  favicon_id: null,
};

/** Replace "{year}" with the current year — used in the footer notice. */
export function renderTemplate(text: string | null | undefined): string {
  return (text ?? "").replaceAll("{year}", String(new Date().getFullYear()));
}

/**
 * Accept only a CSS hex colour. Anything else is refused rather than written
 * into a stylesheet — a stray value here would land inside a `<style>` tag.
 */
export function isHexColor(value: unknown): value is string {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(value ?? "").trim());
}

/** Normalise to "#rrggbb", or null when it is not a colour at all. */
export function toHexColor(value: unknown): string | null {
  const v = String(value ?? "").trim();
  if (!isHexColor(v)) return null;
  if (v.length === 4) {
    // #abc -> #aabbcc, so the stored value is always comparable.
    return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`.toLowerCase();
  }
  return v.toLowerCase();
}

/** "#818cf8" -> "129 140 248", for building rgba() from a token. */
export function hexToRgb(hex: string): string | null {
  const v = toHexColor(hex);
  if (!v) return null;
  return [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16)).join(" ");
}

/**
 * The CSS that re-points the accent (and optionally the sidebar) tokens at the
 * configured colours. Returns "" when nothing is customised, so the stylesheet
 * in globals.css stays in charge.
 *
 * Every value passes through `toHexColor` first, so only a hex literal can
 * ever reach the stylesheet.
 */
/** WCAG relative luminance of a hex colour, 0 (black) to 1 (white). */
export function luminance(hex: string): number | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.split(" ").map((v) => {
    const c = Number(v) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio between a colour and white, the text colour on filled buttons. */
export function contrastWithWhite(hex: string): number | null {
  const l = luminance(hex);
  return l === null ? null : 1.05 / (l + 0.05);
}

/** Mix a hex colour with black. `amount` 0 = unchanged, 1 = black. */
function darken(hex: string, amount: number): string {
  const v = toHexColor(hex);
  if (!v) return hex;
  const ch = [1, 3, 5]
    .map((i) => Math.round(parseInt(v.slice(i, i + 2), 16) * (1 - amount)))
    .map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0"));
  return `#${ch.join("")}`;
}

/**
 * The accent to use on the light theme.
 *
 * A colour picked while the app is in dark mode is usually a pale one — it has
 * to sit on a near-black surface. The same value on a white page gives washed
 * out buttons with unreadable white labels, so it is darkened just far enough
 * to carry white text (4:1, between WCAG AA for large and normal text).
 * A colour that already passes is returned untouched.
 */
export function accentForLight(hex: string): string {
  const v = toHexColor(hex);
  if (!v) return hex;
  for (let step = 0; step <= 6; step++) {
    const candidate = step === 0 ? v : darken(v, step * 0.1);
    const ratio = contrastWithWhite(candidate);
    if (ratio !== null && ratio >= 4) return candidate;
  }
  return darken(v, 0.6);
}

export function paletteCss(s: AppSettings): string {
  const rules: string[] = [];
  const accent = toHexColor(s.accent_color);
  const accentFg = toHexColor(s.accent_fg_color);
  const sidebarBg = toHexColor(s.sidebar_bg);
  const sidebarText = toHexColor(s.sidebar_text);

  // The light theme needs its own block: these rules land after the
  // stylesheet, so a bare :root would override [data-theme="light"] and leave
  // a dark-mode accent washed out on a white page.
  const light: string[] = [];

  if (accent) {
    const rgb = hexToRgb(accent);
    rules.push(`--accent:${accent}`);
    if (rgb) {
      rules.push(`--accent-soft:rgb(${rgb} / 0.15)`);
      rules.push(`--ring:rgb(${rgb} / 0.35)`);
    }

    const lightAccent = accentForLight(accent);
    const lightRgb = hexToRgb(lightAccent);
    light.push(`--accent:${lightAccent}`);
    if (lightRgb) {
      light.push(`--accent-soft:rgb(${lightRgb} / 0.12)`);
      light.push(`--ring:rgb(${lightRgb} / 0.35)`);
    }
  }
  if (accentFg) {
    rules.push(`--accent-fg:${accentFg}`);
    // Accent text sits on the soft tint, so it needs the same correction.
    light.push(`--accent-fg:${accentForLight(accentFg)}`);
  }
  if (sidebarBg) rules.push(`--sidebar-bg:${sidebarBg}`);
  if (sidebarText) rules.push(`--sidebar-text:${sidebarText}`);

  if (rules.length === 0) return "";
  const dark = `:root{${rules.join(";")}}`;
  return light.length ? `${dark}[data-theme="light"]{${light.join(";")}}` : dark;
}
