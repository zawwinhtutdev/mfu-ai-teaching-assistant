import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import {
  DEMO_EMAIL_COOKIE,
  DEMO_ROLE_COOKIE,
  getDemoAccountByRole,
} from "@/lib/demo-auth"
import { mockTeacherCourses } from "@/lib/mock-data"
import { toUserRole } from "@/lib/auth/roles"

/**
 * Lightweight teacher courses endpoint.
 * Previously used getTeacherPortalData() which called getUser() (~300ms)
 * and fetched student_queries unnecessarily.
 * Now uses getSession() (~1ms) and a single courses query.
 */
export async function GET() {
  const cookieStore = await cookies()
  const demoRole = cookieStore.get(DEMO_ROLE_COOKIE)?.value
  const demoEmail = cookieStore.get(DEMO_EMAIL_COOKIE)?.value
  const demoAccount = getDemoAccountByRole(demoRole)
  const isDemoSession = !!(
    demoAccount &&
    demoEmail &&
    demoEmail.toLowerCase() === demoAccount.email.toLowerCase()
  )

  if (isDemoSession && demoAccount) {
    if (demoRole !== "teacher") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    return NextResponse.json({ courses: mockTeacherCourses })
  }

  const supabase = await createClient()
  // PERFORMANCE: Use getSession() for fast local JWT validation (~1ms)
  // instead of getUser() which makes a network call (~200-400ms).
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = session.user
  // Authoritative role lookup — never user_metadata (user-writable).
  const { data: profileRow } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  const role = toUserRole(profileRow?.role)

  if (role !== "teacher" && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { data: courses, error } = await supabase
    .from("courses")
    .select("id, title, code")
    .eq("teacher_id", user.id)
    .order("created_at")

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ courses: courses || [] })
}
