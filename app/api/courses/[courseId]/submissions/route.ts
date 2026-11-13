import { NextResponse } from "next/server"

import { assertCourseAccess, clientForPrincipal, resolvePrincipal } from "@/lib/server/principal"

/**
 * The whole submission picture for a course: every assignment, every enrolled
 * student, and every submission between them.
 *
 * This exists so the teacher can grade from a table instead of opening one
 * dialog per student. The per-assignment route still serves the student's own
 * view; this one is teacher-only and reads across the course.
 */

type RouteContext = { params: Promise<{ courseId: string }> }

export async function GET(_req: Request, { params }: RouteContext) {
  const { courseId } = await params
  const principal = await resolvePrincipal()
  if (!principal) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (principal.role !== "teacher" && principal.role !== "admin") {
    return NextResponse.json({ error: "Only a teacher may view the gradebook" }, { status: 403 })
  }

  const course = await assertCourseAccess(principal, courseId)
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 })

  const supabase = await clientForPrincipal(principal)

  const [assignmentsResult, enrollmentsResult] = await Promise.all([
    supabase
      .from("assignments")
      .select("id, title, due_at, points, visible_to_students")
      .eq("course_id", course.id)
      .order("due_at", { ascending: true, nullsFirst: false }),
    supabase
      .from("course_enrollments")
      .select("student_id, profiles:student_id(id, email, full_name)")
      .eq("course_id", course.id),
  ])

  if (assignmentsResult.error) {
    return NextResponse.json({ error: assignmentsResult.error.message }, { status: 500 })
  }

  const students = (enrollmentsResult.data ?? [])
    .map((row: any) => {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
      if (!profile) return null
      return {
        id: profile.id as string,
        email: profile.email as string,
        full_name: (profile.full_name ?? null) as string | null,
      }
    })
    .filter(Boolean) as Array<{ id: string; email: string; full_name: string | null }>

  const assignments = assignmentsResult.data ?? []

  // One query for every submission in the course, then keyed in memory. Asking
  // per assignment would be N+1 round trips for a table we render all at once.
  let submissions: any[] = []
  if (assignments.length > 0) {
    const { data, error } = await supabase
      .from("assignment_submissions")
      .select("id, assignment_id, student_id, submitted_at, grade, feedback, file_name")
      .in(
        "assignment_id",
        assignments.map((assignment: any) => assignment.id),
      )

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    submissions = data ?? []
  }

  return NextResponse.json({
    course: { id: course.id, code: course.code, title: course.title },
    assignments,
    students,
    submissions,
  })
}
