import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LeadSpot — Trouvez des prospects sans site web",
  description:
    "LeadSpot repère les établissements locaux (restaurants, salons, commerces...) sans site web, pour la prospection freelance/agence web.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
