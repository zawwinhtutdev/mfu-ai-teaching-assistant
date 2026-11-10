import { NextResponse } from "next/server"
import { fetchMyCourses } from "@/lib/server/academic"
import { requireAdminUser } from "@/lib/server/admin-auth"

export async function GET() {
  try {
    const admin = await requireAdminUser()
    if (!admin.user || !admin.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const courses = await fetchMyCourses()
    if (!courses) {
      return NextResponse.json({ error: "Courses unavailable" }, { status: 503 })
    }

    return NextResponse.json({ courses })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load courses"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
