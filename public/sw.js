/* Service worker LeadSpot.
 * Stratégie :
 *  - les appels API (/api/*) ne sont JAMAIS mis en cache (données fraîches) ;
 *  - les navigations : réseau d'abord, repli sur le cache si hors ligne ;
 *  - les assets statiques (JS/CSS/images) : stale-while-revalidate.
 * À incrémenter (CACHE_NAME) à chaque déploiement impactant le shell. */
const CACHE_NAME = "leadspot-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/dashboard";
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of allClients) {
        if ("focus" in client) {
          await client.focus();
          await client.navigate(url);
          return;
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(url);
    })()
  );
});

self.addEventListener("push", (event) => {
  let data = { title: "LeadSpot", body: "" };
  try {
    data = { ...data, ...JSON.parse(event.data?.text() || "{}") };
  } catch {
    /* payload malformé : on affiche le texte brut s'il existe */
    if (event.data) data = { ...data, body: event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      data: { url: data.url || "/dashboard" },
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: "leadspot-new-leads",
      renotify: true,
    })
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || caches.match("/");
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);

  return cached || network;
}
