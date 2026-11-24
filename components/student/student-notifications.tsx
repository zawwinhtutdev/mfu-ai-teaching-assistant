"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Bell, FileText, Megaphone } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

type NotificationItem = {
  id: string
  kind: "announcement" | "material"
  title: string
  snippet: string
  createdAt: string
  href: string
  courseCode: string
}

const SEEN_KEY = "mfu-student-notifications-seen"

function relativeTime(value: string) {
  const then = new Date(value).getTime()
  if (Number.isNaN(then)) return ""
  const minutes = Math.floor((Date.now() - then) / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(value).toLocaleDateString()
}

export function StudentNotifications() {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [open, setOpen] = useState(false)
  // Lazy so the first paint already knows the read watermark; the server has no
  // storage, hence the empty fallback.
  const [lastSeen, setLastSeen] = useState<string>(() => {
    if (typeof window === "undefined") return ""
    try {
      return window.localStorage.getItem(SEEN_KEY) || new Date().toISOString()
    } catch {
      return new Date().toISOString()
    }
  })

  // First visit: persist the "now" watermark so a fresh account is not greeted
  // with a backlog badge; anything uploaded later still shows up.
  useEffect(() => {
    try {
      if (!window.localStorage.getItem(SEEN_KEY)) window.localStorage.setItem(SEEN_KEY, lastSeen)
    } catch {
      // Storage can be unavailable; the panel still lists activity.
    }
  }, [lastSeen])

  useEffect(() => {
    let cancelled = false

    fetch("/api/student/notifications", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && Array.isArray(data?.notifications)) setItems(data.notifications)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [])

  const unread = items.filter((item) => !lastSeen || item.createdAt > lastSeen).length

  const markAllRead = () => {
    const now = new Date().toISOString()
    try {
      window.localStorage.setItem(SEEN_KEY, now)
    } catch {
      // Ignore storage failures; the in-memory value still clears the badge.
    }
    setLastSeen(now)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute right-0 top-0 grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-none text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-semibold">Notifications</p>
          {unread > 0 && (
            <button type="button" onClick={markAllRead} className="text-xs font-medium text-blue-600 hover:underline">
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              No announcements or new materials yet.
            </p>
          ) : (
            items.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex gap-3 border-b px-3 py-2.5 last:border-0 hover:bg-muted/60"
              >
                <span className="mt-0.5 text-muted-foreground">
                  {item.kind === "material" ? <FileText className="h-4 w-4" /> : <Megaphone className="h-4 w-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium">{item.title}</span>
                    {(!lastSeen || item.createdAt > lastSeen) && (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" aria-hidden />
                    )}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {item.courseCode ? `${item.courseCode} · ` : ""}
                    {relativeTime(item.createdAt)}
                  </span>
                </span>
              </Link>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
