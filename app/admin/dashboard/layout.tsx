"use client"

import type React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  BarChart3,
  Users,
  FileText,
  ShieldCheck,
  Bell,
  Shield,
  LogOut,
  Menu,
  X,
} from "lucide-react"
import { useEffect, useState } from "react"
import { BrandIcon } from "@/components/brand-icon"

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "Overview", icon: BarChart3 },
  { href: "/admin/dashboard/users", label: "Users", icon: Users },
  { href: "/admin/dashboard/audit-logs", label: "Audit Logs", icon: FileText },
  { href: "/admin/dashboard/privacy", label: "Privacy", icon: ShieldCheck },
  { href: "/admin/dashboard/notifications", label: "Notifications", icon: Bell },
  { href: "/admin/dashboard/policies", label: "Policies", icon: Shield },
]

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [adminEmail, setAdminEmail] = useState("")

  useEffect(() => {
    fetch("/api/admin/status")
      .then((r) => r.json())
      .then((d) => setAdminEmail(d.email || ""))
      .catch(() => {})
  }, [])

  const isActive = (href: string) => {
    if (href === "/admin/dashboard") return pathname === "/admin/dashboard"
    return pathname.startsWith(href)
  }

  const handleLogout = async () => {
    // Clear demo auth cookies
    await fetch("/api/demo-auth/logout", { method: "POST" })
    // Sign out from real Supabase auth
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/admin/login")
    router.refresh()
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "'Euclid Circular A', Inter, system-ui, sans-serif" }}>
      {/* Sidebar */}
      <aside
        style={{
          width: "260px",
          background: "linear-gradient(180deg, #5a0a1a 0%, #3a0610 100%)",
          display: "flex",
          flexDirection: "column",
          position: "fixed",
          top: 0,
          left: sidebarOpen ? 0 : undefined,
          bottom: 0,
          zIndex: 50,
          transition: "transform 0.2s",
          transform: sidebarOpen ? "translateX(0)" : undefined,
        }}
        className="admin-sidebar"
      >
        {/* Brand */}
        <div
          style={{
            padding: "24px 20px 20px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <BrandIcon size={36} tone="light" className="shrink-0" />
            <div>
              <p style={{ color: "#fff", fontSize: "15px", fontWeight: 700, margin: 0, lineHeight: 1.2 }}>
                Admin Console
              </p>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "11px", margin: 0, letterSpacing: "0.04em" }}>
                MFU AI Teaching Assistant
              </p>
            </div>
          </div>
        </div>

        {/* Nav Links */}
        <nav style={{ flex: 1, padding: "16px 12px", display: "flex", flexDirection: "column", gap: "4px" }}>
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: active ? 600 : 400,
                  color: active ? "#fff" : "rgba(255,255,255,0.55)",
                  background: active ? "rgba(255,255,255,0.1)" : "transparent",
                  textDecoration: "none",
                  transition: "all 0.15s",
                  borderLeft: "none",
                }}
              >
                <item.icon size={18} style={{ opacity: active ? 1 : 0.6 }} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Bottom */}
        <div style={{ padding: "16px 12px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <div
            style={{
              padding: "12px 14px",
              borderRadius: "8px",
              background: "rgba(255,255,255,0.04)",
              marginBottom: "12px",
            }}
          >
            <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "12px", fontWeight: 600, margin: "0 0 2px" }}>
              Signed in as
            </p>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "11px", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {adminEmail || "..."}
            </p>
          </div>
          <button
            onClick={handleLogout}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              width: "100%",
              padding: "10px 14px",
              borderRadius: "8px",
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.5)",
              fontSize: "13px",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 40,
          }}
        />
      )}

      {/* Main content */}
      <div style={{ flex: 1, marginLeft: "260px", display: "flex", flexDirection: "column" }}>


        {/* Page content */}
        <main style={{ flex: 1, padding: "28px 32px", background: "#f8f8f6" }}>
          {children}
        </main>
      </div>

      {/* Responsive CSS */}
      <style>{`
        @media (max-width: 768px) {
          .admin-sidebar {
            transform: translateX(-100%) !important;
          }
          .admin-sidebar[style*="translateX(0)"] {
            transform: translateX(0) !important;
          }
          .admin-mobile-menu {
            display: block !important;
          }
          div[style*="marginLeft: \\"260px\\""] {
            margin-left: 0 !important;
          }
        }
      `}</style>
    </div>
  )
}
