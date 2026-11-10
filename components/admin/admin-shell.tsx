"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { PortalShell, type PortalNavGroup, type PortalRailItem } from "@/components/portal/portal-shell"
import {
  LayoutGrid,
  Users,
  ShieldCheck,
  Bell,
  Shield,
  Settings,
  Building2,
  Home,
  List,
  SlidersHorizontal,
  CheckCheck,
  Send,
  Play,
  Download,
  ScrollText,
  Headphones,
  FileText,
} from "lucide-react"

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || ""
  const router = useRouter()
  const [email, setEmail] = useState("")

  useEffect(() => {
    fetch("/api/admin/status")
      .then((r) => r.json())
      .then((d) => setEmail(d.email || ""))
      .catch(() => {})
  }, [])

  const signOut = async () => {
    try {
      await fetch("/api/demo-auth/logout", { method: "POST" })
      const { createClient } = await import("@/lib/supabase/client")
      await createClient().auth.signOut()
    } catch {
      /* ignore */
    }
    router.push("/admin/login")
    router.refresh()
  }

  // the login screen keeps its own full-bleed layout
  if (pathname.startsWith("/admin/login")) return <>{children}</>

  const nav: PortalNavGroup[] = [
    {
      label: "Organization",
      items: [
        { href: "/admin/dashboard/org", label: "Organization", icon: Building2, chevron: true },
        { href: "/admin/dashboard/users", label: "Members", icon: Users, chevron: true },
      ],
    },
    {
      label: "Feature",
      items: [
        { href: "/admin/dashboard", label: "Home", icon: Home, exact: true, chevron: true },
        { href: "/admin/dashboard", label: "Courses", icon: LayoutGrid, exact: true, chevron: true },
        { href: "/admin/dashboard", label: "Course List", icon: List, exact: true, depth: 1 },
        { href: "/admin/dashboard/manage/info-fields", label: "Course Info Fields", icon: SlidersHorizontal, depth: 1 },
        { href: "/admin/dashboard/manage/approval", label: "Course Approval", icon: CheckCheck, depth: 1 },
        { href: "/admin/dashboard/manage/bulk-post", label: "Bulk Post", icon: Send, depth: 1 },
        { href: "/admin/dashboard/manage/playback", label: "Simultaneous playback restrictions", icon: Play, depth: 1 },
        { href: "/admin/dashboard/manage/downloads", label: "File download settings", icon: Download, depth: 1 },
        { href: "/admin/dashboard/manage/defaults", label: "Course default settings", icon: Settings, depth: 1 },
      ],
    },
    {
      label: "System",
      items: [
        { href: "/admin/dashboard/notifications", label: "Notifications", icon: Bell },
        { href: "/admin/dashboard/policies", label: "Policies", icon: Shield },
        { href: "/admin/dashboard/privacy", label: "Privacy", icon: ShieldCheck },
        { href: "/admin/dashboard/audit-logs", label: "Audit logs", icon: ScrollText },
      ],
    },
    {
      label: "Support",
      items: [{ href: "mailto:support@mfu.ac.th", label: "Contact", icon: Headphones }],
    },
  ]

  const railItems: PortalRailItem[] = [
    { href: "/admin/dashboard", label: "Console", icon: LayoutGrid },
    { href: "/admin/dashboard/users", label: "Users", icon: Users },
    { href: "/admin/dashboard/audit-logs", label: "Audit", icon: FileText },
    { href: "/admin/dashboard/policies", label: "Policy", icon: Shield },
  ]

  const titleMap: Record<string, string> = {
    "/admin/dashboard": "Manage courses",
    "/admin/dashboard/users": "Members",
    "/admin/dashboard/audit-logs": "Audit Logs",
    "/admin/dashboard/privacy": "Privacy",
    "/admin/dashboard/policies": "Policies",
    "/admin/dashboard/notifications": "Notifications",
    "/admin/dashboard/org": "Organization",
  }
  const key = pathname.replace(/\/$/, "")
  const title = key.startsWith("/admin/dashboard/manage")
    ? "Course settings"
    : titleMap[key] || "Admin Console"

  return (
    <PortalShell
      variant="admin"
      chrome="topbar"
      productName="Admin Console"
      contextChip="Production"
      title={title}
      crumbs={["Admin Console", title]}
      nav={nav}
      railItems={railItems}
      extra={
        email ? (
          <div style={{ marginTop: "auto", padding: "14px 10px 0", borderTop: "1px solid var(--p-line)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--p-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Signed in as
            </div>
            <div style={{ fontSize: 12, color: "var(--p-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {email}
            </div>
          </div>
        ) : null
      }
      onNavigate={(href) => {
        if (href === "#signout") {
          void signOut()
          return true
        }
        return false
      }}
      actions={null}
    >
      {children}
    </PortalShell>
  )
}
