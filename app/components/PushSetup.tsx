"use client";

import { useEffect, useState } from "react";

/** Convertit une clé VAPID base64url en Uint8Array (format attendu par le PushManager). */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Url = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Url);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

/**
 * Activation/désactivation des notifications push des zones suivies.
 * Le service worker (`public/sw.js`) reçoit l'événement `push` et affiche la
 * notification ; l'abonnement est enregistré via `/api/push/subscribe`.
 */
export default function PushSetup() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refreshStatus() {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setSupported(false);
      return;
    }
    setSupported(true);
    setPermission(Notification.permission);
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      setSubscribed(Boolean(sub));
    } catch {
      setSubscribed(false);
    }
  }

  useEffect(() => {
    refreshStatus();
  }, []);

  async function handleEnable() {
    setError(null);
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      setPermission(permission);
      if (permission !== "granted") {
        setError("Permission refusée. Autorisez les notifications dans les réglages de votre appareil.");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing ?? (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""),
      }));

      if (!subscription) {
        setError("Impossible de créer l'abonnement push.");
        return;
      }

      const json = subscription.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          p256dh: (json.keys as { p256dh: string }).p256dh,
          auth: (json.keys as { auth: string }).auth,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Échec de l'enregistrement de l'abonnement.");
        return;
      }

      setSubscribed(true);
    } catch {
      setError("Une erreur est survenue lors de l'activation des notifications.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDisable() {
    setError(null);
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setSubscribed(false);
    } catch {
      setError("Une erreur est survenue lors de la désactivation des notifications.");
    } finally {
      setLoading(false);
    }
  }

  if (!supported) return null;

  return (
    <section className="mt-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 sm:p-6 dark:bg-gray-900 dark:ring-gray-800">
      <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Notifications push</h2>

      {error && <p className="animate-fade-in-up mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <button
        onClick={subscribed ? handleDisable : handleEnable}
        disabled={loading}
        className={`mt-3 w-full rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-150 active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100 sm:w-auto ${
          subscribed
            ? "border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            : "bg-brand-600 text-white hover:bg-brand-700"
        }`}
      >
        {loading
          ? "Mise à jour..."
          : subscribed
            ? "Notifications activées ✓ — désactiver"
            : "Activer les notifications"}
      </button>
    </section>
  );
}
