import type React from "react"
import type { Metadata } from "next"
import { AdminShell } from "@/components/admin/admin-shell"

export const metadata: Metadata = {
  title: "Admin Console — MFU AI Teaching Assistant",
  description: "Internal management console for MFU AI Teaching Assistant",
}

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
