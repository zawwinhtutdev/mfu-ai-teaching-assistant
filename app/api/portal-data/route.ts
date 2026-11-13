import { NextResponse } from "next/server"

import { resolvePrincipal } from "@/lib/server/principal"
import { getStudentPortalData, getTeacherPortalData } from "@/lib/server/session-data"

/**
 * Portal bootstrap payload.
 *
 * The auth check was `supabase.auth.getUser()` only, so a demo session got a
 * 401 even though every portal page had already rendered for that same user
 * server-side. Identity now comes from `resolvePrincipal`, and the role decides
 * which payload is returned.
 */
export async function GET() {
  try {
    const principal = await resolvePrincipal()
    if (!principal) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (principal.role === "teacher" || principal.role === "admin") {
      const teacherData = await getTeacherPortalData()
      return NextResponse.json({
        profile: teacherData.profile,
        courses: teacherData.courses,
      })
    }

    const studentData = await getStudentPortalData()
    return NextResponse.json({
      profile: studentData.profile,
      courses: studentData.courses,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to fetch portal data" },
      { status: 500 },
    )
  }
}
