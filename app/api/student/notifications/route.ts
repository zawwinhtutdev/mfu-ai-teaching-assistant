import { NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { slugify } from "@/lib/utils"

export const dynamic = "force-dynamic"

type NotificationItem = {
  id: string
  kind: "announcement" | "material"
  title: string
  snippet: string
  createdAt: string
  href: string
  courseCode: string
}

function snippet(value: string | null | undefined) {
  return (value || "").replace(/\s+/g, " ").trim().slice(0, 120)
}

/**
 * Activity feed for a student: announcements and newly published materials in
 * the courses they are enrolled in. Derived from existing rows rather than a
 * notifications table so there is nothing to backfill or fan out on upload.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: enrollments } = await supabase
      .from("course_enrollments")
      .select("course_id")
      .eq("student_id", user.id)

    const courseIds = Array.from(
      new Set((enrollments || []).map((row: any) => row.course_id).filter(Boolean)),
    ) as string[]

    if (courseIds.length === 0) {
      return NextResponse.json({ notifications: [] })
    }

    const [{ data: courses }, { data: announcements }, { data: materials }] = await Promise.all([
      supabase.from("courses").select("id, code, title").in("id", courseIds),
      supabase
        .from("announcements")
        .select("id, course_id, title, content, created_at")
        .in("course_id", courseIds)
        .order("created_at", { ascending: false })
        .limit(15),
      supabase
        .from("course_materials")
        .select("id, course_id, title, material_type, created_at")
        .in("course_id", courseIds)
        .eq("approval_status", "published")
        .order("created_at", { ascending: false })
        .limit(15),
    ])

    const courseById = new Map<string, { code: string; title: string }>()
    for (const course of courses || []) {
      courseById.set(course.id, { code: course.code || "", title: course.title || "Course" })
    }

    const items: NotificationItem[] = [
      ...(announcements || []).map((row: any) => {
        const course = courseById.get(row.course_id)
        return {
          id: `announcement:${row.id}`,
          kind: "announcement" as const,
          title: row.title || "New announcement",
          snippet: snippet(row.content),
          createdAt: row.created_at,
          href: course ? `/studentportal/mycourses/${slugify(course.title)}` : "/studentportal/mycourses",
          courseCode: course?.code || "",
        }
      }),
      ...(materials || []).map((row: any) => {
        const course = courseById.get(row.course_id)
        return {
          id: `material:${row.id}`,
          kind: "material" as const,
          title: row.title || "New material",
          snippet: `${row.material_type || "Material"} uploaded`,
          createdAt: row.created_at,
          href: course ? `/studentportal/mycourses/${slugify(course.title)}` : "/studentportal/mycourses",
          courseCode: course?.code || "",
        }
      }),
    ]
      .filter((item) => Boolean(item.createdAt))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 20)

    return NextResponse.json({ notifications: items })
  } catch (error) {
    console.error("[student/notifications] failed:", error)
    return NextResponse.json({ notifications: [] }, { status: 500 })
  }
}
