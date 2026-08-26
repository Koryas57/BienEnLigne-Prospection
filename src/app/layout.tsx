import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Bien En Ligne — Prospection", template: "%s · Bien En Ligne" },
  description: "Cockpit de prospection commerciale mobile-first pour Bien En Ligne.",
  applicationName: "Bien En Ligne Prospection",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#0d5c45" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fr"><body>{children}</body></html>;
}
