import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stock Management",
  description:
    "College stock & inventory management — Next.js + PostgreSQL port",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
