"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
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
  List,
  CheckCheck,
  Send,
  Play,
  Download,
  ScrollText,
  Headphones,
  FileText,
  GraduationCap,
  BookOpen,
  LogOut,
  MoreVertical,
  UserRound,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || ""
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [isSigningOut, setIsSigningOut] = useState(false)

  useEffect(() => {
    fetch("/api/admin/status")
      .then((r) => r.json())
      .then((d) => {
        setEmail(d.email || "")
        setName(d.name || "")
      })
      .catch(() => {})
  }, [])

  const signOut = async () => {
    setIsSigningOut(true)
    try {
      // Clear the demo cookie first: it outranks a Supabase session in the
      // middleware, so a stale one would keep the admin signed in after
      // supabase.auth.signOut().
      await fetch("/api/demo-auth/logout", { method: "POST" })
      const { createClient } = await import("@/lib/supabase/client")
      await createClient().auth.signOut()
    } catch {
      /* ignore — redirecting is still the right next step */
    }
    // A full navigation, not router.push: the server must re-read the now-absent
    // cookies, or the middleware still sees an authenticated admin.
    window.location.assign("/admin/login")
  }

  const initials = (name || email || "A")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")

  // the login screen keeps its own full-bleed layout
  if (pathname.startsWith("/admin/login")) return <>{children}</>

  const nav: PortalNavGroup[] = [
    {
      label: "Organization",
      items: [
        { href: "/admin/dashboard/org", label: "Organization", icon: Building2, chevron: true },
        {
          // Members is the parent for every account list. The roles are children
          // rather than tabs on the page so a teacher or student view can be
          // linked to directly (?role=teacher) and stays visible in the sidebar.
          href: "/admin/dashboard/users",
          label: "Members",
          icon: Users,
          children: [
            { href: "/admin/dashboard/users?role=student", label: "Students", icon: GraduationCap, depth: 1 },
            { href: "/admin/dashboard/users?role=teacher", label: "Teachers", icon: BookOpen, depth: 1 },
            { href: "/admin/dashboard/users?role=admin", label: "Administrators", icon: ShieldCheck, depth: 1 },
          ],
        },
      ],
    },
    {
      label: "Feature",
      items: [
        {
          // "Courses" is a disclosure, not a destination: /admin/dashboard *is*
          // the course list, so the old Home + Courses + Course List trio were
          // three links to the same route and all three lit up at once.
          href: "/admin/dashboard/courses",
          label: "Courses",
          icon: LayoutGrid,
          children: [
            { href: "/admin/dashboard", label: "All courses", icon: List, exact: true, depth: 1 },
            // "Course Info Fields" used to live here. It described the fields a
            // course carries, which is per-course information — so it now opens
            // from the course name instead of being a standalone settings page.
            { href: "/admin/dashboard/manage/approval", label: "Course Approval", icon: CheckCheck, depth: 1 },
            { href: "/admin/dashboard/manage/bulk-post", label: "Bulk Post", icon: Send, depth: 1 },
            { href: "/admin/dashboard/manage/playback", label: "Simultaneous playback restrictions", icon: Play, depth: 1 },
            { href: "/admin/dashboard/manage/downloads", label: "File download settings", icon: Download, depth: 1 },
            { href: "/admin/dashboard/manage/defaults", label: "Course default settings", icon: Settings, depth: 1 },
          ],
        },
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
    "/admin/dashboard/profile": "My profile",
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
      title={title}
      crumbs={["Admin Console", title]}
      nav={nav}
      railItems={railItems}
      extra={
        email ? (
          <div
            style={{
              paddingTop: 12,
              borderTop: "1px solid var(--p-line)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {/* Account block: who is signed in, with an explicit way out.
                The Sign Out action used to be wired into `onNavigate` for an
                href no nav item ever used, so the control did not exist. */}
            <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "0 4px" }}>
              <Link
                href="/admin/dashboard/profile"
                title="My profile"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  minWidth: 0,
                  flex: 1,
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 999,
                    background: "#232334",
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 700,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flex: "0 0 auto",
                  }}
                >
                  {initials || "A"}
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span
                    style={{
                      display: "block",
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: "var(--p-fg)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {name || "Administrator"}
                  </span>
                  <span
                    style={{
                      display: "block",
                      fontSize: 11,
                      color: "var(--p-muted)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {email}
                  </span>
                </span>
              </Link>

              {/* Sign out lives in a menu rather than as a permanent button:
                  a destructive session action should not sit in the nav as a
                  primary control you can hit by accident. */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Account menu"
                    title="Account menu"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 26,
                      height: 26,
                      flex: "0 0 auto",
                      border: 0,
                      borderRadius: 6,
                      background: "transparent",
                      color: "var(--p-muted)",
                      cursor: "pointer",
                    }}
                  >
                    <MoreVertical size={15} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="top" className="w-44">
                  <DropdownMenuItem asChild>
                    <Link href="/admin/dashboard/profile" className="cursor-pointer">
                      <UserRound className="mr-2 h-4 w-4" />
                      My profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => void signOut()}
                    disabled={isSigningOut}
                    className="cursor-pointer"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    {isSigningOut ? "Signing out…" : "Sign out"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ) : null
      }
      actions={null}
    >
      {children}
    </PortalShell>
  )
}
