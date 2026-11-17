"use client"

import type React from "react"

/** The admin chrome now lives in components/admin/admin-shell.tsx (shared portal shell). */
export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
