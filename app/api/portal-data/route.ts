import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getStudentPortalData, getTeacherPortalData } from "@/lib/server/session-data"

export async function GET() {
  try {
    // Auth check first
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const data = await getStudentPortalData()
    
    if (data.role === "teacher") {
      const teacherData = await getTeacherPortalData()
      return NextResponse.json({
        profile: teacherData.profile,
        courses: teacherData.courses,
      })
    }

    return NextResponse.json({
      profile: data.profile,
      courses: data.courses,
    })
  } catch {
    return NextResponse.json({ error: "Failed to fetch portal data" }, { status: 500 })
  }
}
