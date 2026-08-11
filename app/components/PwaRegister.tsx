"use client";

import { useEffect } from "react";

/**
 * Enregistre le service worker (prod uniquement) pour activer le mode PWA :
 * installation sur l'écran d'accueil + cache offline du shell de l'app.
 */
export default function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Silencieux : le SW est une amélioration, pas un prérequis.
      });
    };

    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}
