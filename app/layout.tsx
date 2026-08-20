import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";
import PwaRegister from "./components/PwaRegister";

export const metadata: Metadata = {
  title: "LeadSpot — Trouvez des prospects sans site web",
  description:
    "LeadSpot repère les établissements locaux (restaurants, salons, commerces...) sans site web, pour la prospection freelance/agence web.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "LeadSpot",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1d5aeb",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="min-h-screen">
        <Script id="theme-init" strategy="beforeInteractive">
          {`(function () {
            try {
              var stored = localStorage.getItem("leadspot-theme");
              var dark = stored === "dark" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches);
              if (dark) document.documentElement.classList.add("dark");
            } catch (e) {}
          })();`}
        </Script>
        {children}
        <PwaRegister />
        <Analytics />
      </body>
    </html>
  );
}
