import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "./_components/AppShell";

export const metadata: Metadata = {
  title: "Burrow",
  description: "Workspace for a founder doing growth.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
