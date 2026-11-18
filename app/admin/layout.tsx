import type React from "react"
import type { Metadata } from "next"
import { AdminShell } from "@/components/admin/admin-shell"

export const metadata: Metadata = {
  title: "Admin Console — MFU AI Teaching Assistant",
  description: "Internal management console for MFU AI Teaching Assistant",
}

/**
 * The console is always dynamic.
 *
 * Every page here reads live data (users, courses, audit logs) and is gated on an
 * admin session, so static prerendering is both wrong and impossible: the shared
 * `PortalShell` calls `useSearchParams()` to highlight the active nav item, which
 * cannot be prerendered without a Suspense boundary. Rendering on demand is what
 * this section actually needs.
 */
export const dynamic = "force-dynamic"

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div id="admin-root" data-theme="light" style={{ colorScheme: "light" }}>
      <AdminShell>{children}</AdminShell>
    </div>
  )
}
