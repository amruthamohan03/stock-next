import type { Metadata } from "next";
import "./globals.css";
import { getAppSettings } from "@/lib/app-settings-queries";

/**
 * Title and favicon come from the application settings, so rebranding the app
 * does not need a code change. generateMetadata runs per request; the loader
 * falls back to the defaults if the table cannot be read.
 */
export async function generateMetadata(): Promise<Metadata> {
  const s = await getAppSettings();
  return {
    title: s.tab_title,
    description: s.tagline ?? undefined,
    icons: s.favicon_id ? { icon: `/api/attachment?id=${s.favicon_id}` } : undefined,
  };
}

// Set the theme before first paint to avoid a flash. Defaults to dark.
const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}else{document.documentElement.setAttribute('data-theme','dark');}}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
