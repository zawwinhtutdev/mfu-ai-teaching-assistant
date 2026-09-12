import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { DEMO_ROLE_COOKIE, DEMO_EMAIL_COOKIE, isDemoRole } from "@/lib/demo-auth"

function parseAdminEmails() {
  return new Set(
    String(process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  )
}

export async function requireAdminUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Check for real Supabase user
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("id,email,role,full_name").eq("id", user.id).maybeSingle()
    const adminEmails = parseAdminEmails()
    const email = (profile?.email || user.email || "").toLowerCase()
    const isAdmin = profile?.role === "admin" || (!!email && adminEmails.has(email))

    return {
      supabase,
      user,
      profile: profile || null,
      isAdmin,
    }
  }

  // Check for demo admin user (cookie-based auth)
  const cookieStore = await cookies()
  const demoRole = cookieStore.get(DEMO_ROLE_COOKIE)?.value
  const demoEmail = cookieStore.get(DEMO_EMAIL_COOKIE)?.value

  if (isDemoRole(demoRole) && demoRole === "admin") {
    return {
      supabase,
      user: { id: "mock-admin-1", email: demoEmail || "admin@mfu.ac.th" } as any,
      profile: { id: "mock-admin-1", email: demoEmail || "admin@mfu.ac.th", role: "admin", full_name: "MFU Admin" },
      isAdmin: true,
    }
  }

  return { supabase, user: null, profile: null, isAdmin: false }
}
