"use client"

import { useEffect } from "react"

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => Promise.all(registrations.map((reg) => reg.unregister())))
        .catch(() => {})

      if ("caches" in window) {
        caches
          .keys()
          .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
          .catch(() => {})
      }
      return
    }

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        console.log("[SW] Registered:", reg.scope)
      })
      .catch((err) => {
        console.warn("[SW] Registration failed:", err)
      })
  }, [])

  return null
}
