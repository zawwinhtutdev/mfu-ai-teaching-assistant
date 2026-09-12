import type React from "react"
import type { Metadata } from "next"

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
    <div
      id="admin-root"
      style={{
        /* Reset all inherited theme styles so the admin pages control their own look */
        colorScheme: "light",
        backgroundColor: "#f4f3ef",
        color: "#00001b",
      }}
      data-theme="light"
    >
      {children}
    </div>
  )
}
