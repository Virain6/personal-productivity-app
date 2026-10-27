import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { TimerProvider } from "@/features/timer/timer-provider";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "Planner",
  applicationName: "Planner",
  appleWebApp: { capable: true, title: "Planner", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
  description: "A personal space for learning, projects, and everyday habits.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#101114",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-elevated focus:p-3"
        >
          Skip to content
        </a>
        <TimerProvider>
          <AppShell>{children}</AppShell>
        </TimerProvider>
      </body>
    </html>
  );
}
