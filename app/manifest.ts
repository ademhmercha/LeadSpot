import type { MetadataRoute } from "next";

/**
 * Manifest PWA : rend LeadSpot installable sur mobile/desktop
 * (icône sur l'écran d'accueil, mode standalone, thème).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LeadSpot — Prospects sans site web",
    short_name: "LeadSpot",
    description:
      "LeadSpot repère les établissements locaux sans site web pour la prospection freelance/agence web.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f9fafb",
    theme_color: "#1d5aeb",
    lang: "fr",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
