import { NextResponse } from "next/server"

import { requireAdminUser } from "@/lib/server/admin-auth"
import { createServiceRoleClient, hasServiceRoleKey } from "@/lib/supabase/admin"
import { logAuditEvent } from "@/lib/server/audit-log"

/**
 * Course enrolment, managed by an administrator.
 *
 * A course's roster is part of setting the course up, so it lives next to
 * course creation rather than in the student portal. Students enrolling
 * themselves remains possible elsewhere; this is the admin-side path.
 */

async function requireAdmin() {
  const admin = await requireAdminUser()
  if (!admin.user || !admin.isAdmin) return null
  return admin
}

/** GET ?courseId= — the roster plus everyone who could still be added. */
export async function GET(req: Request) {
  try {
    const admin = await requireAdmin()
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const courseId = new URL(req.url).searchParams.get("courseId")
    if (!courseId) {
      return NextResponse.json({ error: "courseId is required" }, { status: 400 })
    }

    if (!hasServiceRoleKey()) {
      return NextResponse.json({ error: "Service role key is not configured" }, { status: 503 })
    }
    const supabase = createServiceRoleClient()

    const [enrolledResult, studentsResult] = await Promise.all([
      supabase
        .from("course_enrollments")
        .select("student_id, enrolled_at, section_id")
        .eq("course_id", courseId),
      supabase
        .from("profiles")
        .select("id, full_name, email, role")
        .eq("role", "student")
        .order("full_name", { ascending: true }),
    ])

    if (enrolledResult.error) {
      return NextResponse.json({ error: enrolledResult.error.message }, { status: 500 })
    }
    if (studentsResult.error) {
      return NextResponse.json({ error: studentsResult.error.message }, { status: 500 })
    }

    const enrollmentByStudent = new Map(
      (enrolledResult.data ?? []).map(
        (row) => [row.student_id, { enrolled_at: row.enrolled_at, section_id: row.section_id ?? null }] as const,
      ),
    )
    const students = studentsResult.data ?? []

    // Resolve names server-side. The client used to re-query profiles with the
    // browser's Supabase session, where the RLS policy only exposes the caller's
    // own row (plus an is_admin() check) — so the roster rendered as an empty
    // list even though the ids were there.
    const enrolled = students
      .filter((student) => enrollmentByStudent.has(student.id))
      .map((student) => {
        const placement = enrollmentByStudent.get(student.id)!
        return {
          ...student,
          enrolled_at: placement.enrolled_at ?? null,
          section_id: placement.section_id,
        }
      })

    const available = students.filter((student) => !enrollmentByStudent.has(student.id))

    return NextResponse.json({
      enrolled,
      available,
      enrolledIds: enrolled.map((student) => student.id),
      totalStudents: students.length,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to load enrolment" }, { status: 500 })
  }
}

/** POST — add students to a course. */
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin()
    if (!admin) {
      return NextResponse.json({ error: "Only an administrator may enrol students" }, { status: 403 })
    }

    if (!hasServiceRoleKey()) {
      return NextResponse.json({ error: "Service role key is not configured" }, { status: 503 })
    }

    let body: any
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const courseId = typeof body?.courseId === "string" ? body.courseId.trim() : ""
    const studentIds: string[] = Array.isArray(body?.studentIds)
      ? body.studentIds.filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
      : []
    // Optional: place everyone in this batch into one section.
    const sectionId =
      typeof body?.sectionId === "string" && body.sectionId.trim() ? body.sectionId.trim() : null

    if (!courseId) return NextResponse.json({ error: "courseId is required" }, { status: 400 })
    if (studentIds.length === 0) {
      return NextResponse.json({ error: "studentIds must contain at least one id" }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    // Verify the target ids really are students. Enrolling a teacher would make
    // them appear in the roster and skew the counts.
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, role")
      .in("id", studentIds)

    const validIds = (profiles ?? []).filter((p) => p.role === "student").map((p) => p.id)
    if (validIds.length === 0) {
      return NextResponse.json({ error: "None of those accounts are students" }, { status: 400 })
    }

    // A section must belong to this course, or the placement would be nonsense
    // and the derived per-section count would silently exclude the student.
    if (sectionId) {
      const { data: section } = await supabase
        .from("course_sections")
        .select("id, course_id, capacity")
        .eq("id", sectionId)
        .maybeSingle()
      if (!section || section.course_id !== courseId) {
        return NextResponse.json({ error: "That section does not belong to this course" }, { status: 400 })
      }

      const sectionCapacity = section.capacity ?? null
      const { count: currentInSection } = await supabase
        .from("course_enrollments")
        .select("student_id", { count: "exact", head: true })
        .eq("course_id", courseId)
        .eq("section_id", sectionId)

      const { data: existingRows } = await supabase
        .from("course_enrollments")
        .select("student_id, section_id")
        .eq("course_id", courseId)
        .in("student_id", validIds)

      const newToSection = validIds.filter((id) => {
        const row = (existingRows ?? []).find((r) => r.student_id === id)
        return !row || row.section_id !== sectionId
      })

      if (
        sectionCapacity !== null &&
        (currentInSection ?? 0) + newToSection.length > sectionCapacity
      ) {
        return NextResponse.json({ error: "That section is already at capacity" }, { status: 400 })
      }
    }

    // With a section, upsert updates placement so each student belongs to at most one section.
    const { error } = await supabase
      .from("course_enrollments")
      .upsert(
        validIds.map((studentId) => ({
          course_id: courseId,
          student_id: studentId,
          ...(sectionId ? { section_id: sectionId } : {}),
        })),
        {
          onConflict: "course_id,student_id",
          ignoreDuplicates: sectionId ? false : true,
        },
      )

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await logAuditEvent({
      supabase: admin.supabase as any,
      actorId: admin.user.id,
      action: "admin.students_enrolled",
      resourceType: "course",
      resourceId: courseId,
      metadata: { studentIds: validIds, skipped: studentIds.length - validIds.length },
    })

    return NextResponse.json({ enrolled: validIds.length })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to enrol students" }, { status: 500 })
  }
}

/** DELETE ?courseId=&studentId= — remove one student from the roster. */
export async function DELETE(req: Request) {
  try {
    const admin = await requireAdmin()
    if (!admin) {
      return NextResponse.json({ error: "Only an administrator may change enrolment" }, { status: 403 })
    }

    const url = new URL(req.url)
    const courseId = url.searchParams.get("courseId")
    const studentId = url.searchParams.get("studentId")
    if (!courseId || !studentId) {
      return NextResponse.json({ error: "courseId and studentId are required" }, { status: 400 })
    }

    if (!hasServiceRoleKey()) {
      return NextResponse.json({ error: "Service role key is not configured" }, { status: 503 })
    }
    const supabase = createServiceRoleClient()

    const { error } = await supabase
      .from("course_enrollments")
      .delete()
      .eq("course_id", courseId)
      .eq("student_id", studentId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await logAuditEvent({
      supabase: admin.supabase as any,
      actorId: admin.user.id,
      action: "admin.student_unenrolled",
      resourceType: "course",
      resourceId: courseId,
      metadata: { studentId },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to remove student" }, { status: 500 })
  }
}
