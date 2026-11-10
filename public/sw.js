const CACHE_NAME = "mfu-ai-ta-v9";
const OFFLINE_URL = "/";

// Assets to cache on install
const PRECACHE_ASSETS = [
  "/",
  "/manifest.json",
  "/brand/mfu-crest.png",
  "/icons/crest-tab-16.png",
  "/icons/crest-tab-32.png",
  "/icons/crest-tab-48.png",
  "/icons/crest-180.png",
  "/icons/crest-192.png",
  "/icons/crest-512.png",
  "/icons/crest-maskable-192.png",
  "/icons/crest-maskable-512.png",
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

  // Skip API routes — always go to network
  if (url.pathname.startsWith("/api/")) return;

  // For navigation requests: network first, fall back to cached page
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match(OFFLINE_URL);
      })
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

  // Theme CSS uses stable URLs and changes between deployments. Prefer the
  // network so stale cached CSS is never paired with newer page markup.
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
        icon: "/icons/crest-192.png",
        badge: "/icons/crest-192.png",
        data: { url: data.url || "/" },
      })
    );
  } catch (e) {
    // Fallback for plain text push
    event.waitUntil(
      self.registration.showNotification("MFU AI TA", {
        body: event.data.text(),
        icon: "/icons/crest-192.png",
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
