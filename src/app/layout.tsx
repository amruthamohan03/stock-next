import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stock Management",
  description:
    "College stock & inventory management — Next.js + PostgreSQL port",
};

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
