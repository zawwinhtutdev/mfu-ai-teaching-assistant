const CACHE_NAME = "mfu-ai-ta-v8";
const OFFLINE_URL = "/";
const IS_LOCALHOST =
  self.location.hostname === "localhost" || self.location.hostname === "127.0.0.1";

// Assets to cache on install. The document itself is intentionally NOT
// precached: caching "/" pins the first-seen HTML for every navigation, which
// hides new deployments behind a stale page. Navigations are network-first
// and fall back to whatever document was last cached successfully.
const PRECACHE_ASSETS = [
  "/manifest.json",
  "/brand/mfu-ai-mark-dark.svg",
  "/brand/mfu-ai-mark-light.svg",
  "/brand/mfu-ai-favicon-circle-large.svg",
  "/icons/favicon-circle-large-16.png",
  "/icons/favicon-circle-large-32.png",
  "/icons/apple-touch-icon-mono.png",
  "/icons/icon-mono-192.png",
  "/icons/icon-mono-512.png",
  "/icons/icon-maskable-mono-192.png",
  "/icons/icon-maskable-mono-512.png",
];

// Install: cache critical assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch: network-first for API/navigation, cache-first for static assets
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // Skip API routes and localhost dev bundles — always go to network
  if (url.pathname.startsWith("/api/")) return;
  if (IS_LOCALHOST && url.pathname.startsWith("/_next/")) return;

  // For navigation requests: network first, fall back to the last document
  // that was cached successfully. Successful responses ARE cached here (not at
  // install) so the offline copy tracks deployments instead of pinning the
  // first-seen HTML forever.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(OFFLINE_URL, clone));
          }
          return response;
        })
        .catch(() => caches.match(OFFLINE_URL).then((cached) => cached || Response.error()))
    );
    return;
  }

  // CSS chunks can share paths across builds/dev edits — always prefer network.
  if (url.pathname.endsWith(".css")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Build assets are content-hashed, so they are safe to cache first.
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.endsWith(".woff2")
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Everything else: network first, cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// Push notification handler (for Phase C1 - web push)
self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title || "MFU AI TA", {
        body: data.body || "",
        icon: "/icons/icon-mono-192.png",
        badge: "/icons/icon-mono-192.png",
        data: { url: data.url || "/" },
      })
    );
  } catch (e) {
    // Fallback for plain text push
    event.waitUntil(
      self.registration.showNotification("MFU AI TA", {
        body: event.data.text(),
        icon: "/icons/icon-mono-192.png",
      })
    );
  }
});

// Notification click: open the app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // Focus existing window if open
        for (const client of clients) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        // Otherwise open new window
        return self.clients.openWindow(targetUrl);
      })
  );
});
