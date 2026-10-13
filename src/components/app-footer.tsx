import { renderTemplate, type AppSettings } from "@/lib/app-settings";

/**
 * Fixed footer for the protected shell.
 *
 * Sits at the bottom of the content column (to the right of the sidebar) and
 * stays put while the page scrolls. Marked `no-print` so it never lands on a
 * printed duty list, score card or certificate.
 *
 * The text comes from the application settings; "{year}" in it is replaced
 * with the current year, so the notice cannot go stale.
 */
export default function AppFooter({ settings }: { settings: AppSettings }) {
  const notice = renderTemplate(settings.footer_text);
  const credit = settings.footer_credit ?? "";
  if (!notice && !credit) return null;

  return (
    <footer className="no-print sticky bottom-0 z-20 border-t border-line bg-card/85 px-5 py-2.5 backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 text-center text-[11px] text-muted">
        {notice && <span>{notice}</span>}
        {credit && <span className="text-fg">{credit}</span>}
      </div>
    </footer>
  );
}
