import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { DEMO_ROLE_COOKIE, DEMO_EMAIL_COOKIE, findDemoAccountByEmail } from "@/lib/demo-auth"

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
  const cookieStore = await cookies()

  // Demo identity wins when present: a demo sign-in clears Supabase auth
  // cookies, so the two can never legitimately coexist. Checking it first keeps
  // this helper consistent with the route middleware.
  const demoRole = cookieStore.get(DEMO_ROLE_COOKIE)?.value
  const demoEmail = cookieStore.get(DEMO_EMAIL_COOKIE)?.value
  const demoAccount = findDemoAccountByEmail(demoEmail)

  if (demoAccount?.role === "admin" && demoRole === "admin") {
    return {
      supabase,
      user: { id: demoAccount.profileId, email: demoAccount.email } as any,
      profile: {
        id: demoAccount.profileId,
        email: demoAccount.email,
        role: "admin",
        full_name: demoAccount.fullName,
      },
      isAdmin: true,
    }
  }

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

  return { supabase, user: null, profile: null, isAdmin: false }
}
