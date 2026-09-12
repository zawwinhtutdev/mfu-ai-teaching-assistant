import { NextResponse } from "next/server"
import { hasServiceRoleKey } from "@/lib/supabase/admin"
import { requireAdminUser } from "@/lib/server/admin-auth"

export async function GET() {
  const admin = await requireAdminUser()
  if (!admin.user || !admin.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return NextResponse.json({
    demoMode: !hasServiceRoleKey(),
    isDemoAuth: admin.user.id?.startsWith("mock-"),
    email: admin.user.email || "",
    name: admin.user.user_metadata?.full_name || "",
  })
}
