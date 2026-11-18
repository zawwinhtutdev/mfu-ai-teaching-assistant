import { NextResponse } from "next/server"

import { assertCourseAccess, clientForPrincipal, resolvePrincipal } from "@/lib/server/principal"
import { createServiceRoleClient, hasServiceRoleKey } from "@/lib/supabase/admin"
import { logAuditEvent } from "@/lib/server/audit-log"

/**
 * Submissions for one assignment.
 *
 * A student posts their own work here and reads it back; the teacher sees the
 * whole class and grades. Authorization goes through `assertCourseAccess`, which
 * resolves a uuid or code to the course row and checks the caller may touch it.
 */

type RouteContext = { params: Promise<{ courseId: string; assignmentId: string }> }

/** GET — the caller's own submission, or every submission if they teach the course. */
export async function GET(_req: Request, { params }: RouteContext) {
  const { courseId, assignmentId } = await params
  const principal = await resolvePrincipal()
  if (!principal) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const course = await assertCourseAccess(principal, courseId)
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 })

  const supabase = await clientForPrincipal(principal)

  const isTeacher = principal.role === "teacher" || principal.role === "admin"

  if (isTeacher) {
    const { data, error } = await supabase
      .from("assignment_submissions")
      .select(
        "id, student_id, content, file_url, file_name, submitted_at, updated_at, grade, feedback, graded_at, profiles:student_id(full_name, email)",
      )
      .eq("assignment_id", assignmentId)
      .order("submitted_at", { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      submissions: (data ?? []).map((row: any) => {
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
        return {
          ...row,
          student_name: profile?.full_name ?? null,
          student_email: profile?.email ?? null,
        }
      }),
    })
  }

  // A demo student has no profile row, so they cannot own a submission.
  if (!principal.isPersistable) {
    return NextResponse.json({ submission: null })
  }

  const { data, error } = await supabase
    .from("assignment_submissions")
    .select("id, content, file_url, file_name, submitted_at, updated_at, grade, feedback, graded_at")
    .eq("assignment_id", assignmentId)
    .eq("student_id", principal.userId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ submission: data ?? null })
}

/**
 * POST — a student submits or resubmits.
 *
 * Accepts multipart (for a file) or JSON (text only). Resubmitting replaces the
 * previous answer rather than appending: `unique (assignment_id, student_id)`
 * keeps one row per student, and the upsert targets that constraint.
 */
export async function POST(req: Request, { params }: RouteContext) {
  const { courseId, assignmentId } = await params
  const principal = await resolvePrincipal()
  if (!principal) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (principal.role !== "student") {
    return NextResponse.json({ error: "Only students can submit assignments" }, { status: 403 })
  }

  const course = await assertCourseAccess(principal, courseId)
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 })

  if (!principal.isPersistable) {
    return NextResponse.json(
      { error: "Demo accounts cannot submit. Sign in with a real university account." },
      { status: 403 },
    )
  }

  const supabase = await clientForPrincipal(principal)

  // The assignment must belong to this course, or a student could submit against
  // an assignment id from a course they are not enrolled in.
  const { data: assignment } = await supabase
    .from("assignments")
    .select("id, title, course_id, visible_to_students")
    .eq("id", assignmentId)
    .eq("course_id", course.id)
    .maybeSingle()

  if (!assignment) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 })
  }
  if (!assignment.visible_to_students) {
    return NextResponse.json({ error: "That assignment is not open for submissions" }, { status: 400 })
  }

  const contentType = req.headers.get("content-type") || ""
  let content: string | null = null
  let fileUrl: string | null = null
  let fileName: string | null = null

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData()
    const text = form.get("content")
    if (typeof text === "string" && text.trim()) content = text.trim()

    const file = form.get("file")
    if (file instanceof File && file.size > 0) {
      const admin = hasServiceRoleKey() ? createServiceRoleClient() : null
      const storage = admin ?? supabase
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
      const path = `${principal.userId}/${assignmentId}/${Date.now()}-${safeName}`

      const { error: uploadError } = await storage.storage
        .from("submissions")
        .upload(path, Buffer.from(await file.arrayBuffer()), {
          contentType: file.type || "application/octet-stream",
        })

      if (uploadError) {
        return NextResponse.json({ error: uploadError.message }, { status: 500 })
      }

      const { data: publicUrl } = storage.storage.from("submissions").getPublicUrl(path)
      fileUrl = publicUrl?.publicUrl ?? null
      fileName = file.name
    }
  } else {
    const body = await req.json().catch(() => ({}))
    if (typeof body?.content === "string" && body.content.trim()) content = body.content.trim()
  }

  // A text-only resubmission must not silently drop the file the student
  // attached earlier, so carry the previous attachment forward.
  if (!fileUrl) {
    const { data: previous } = await supabase
      .from("assignment_submissions")
      .select("file_url, file_name")
      .eq("assignment_id", assignmentId)
      .eq("student_id", principal.userId)
      .maybeSingle()
    if (previous?.file_url) {
      fileUrl = previous.file_url
      fileName = previous.file_name
    }
  }

  if (!content && !fileUrl) {
    return NextResponse.json({ error: "Add an answer or attach a file before submitting" }, { status: 400 })
  }

  const now = new Date().toISOString()

  const { data: submission, error } = await supabase
    .from("assignment_submissions")
    .upsert(
      {
        assignment_id: assignmentId,
        student_id: principal.userId,
        content,
        file_url: fileUrl,
        file_name: fileName,
        submitted_at: now,
        updated_at: now,
        // A resubmission clears the previous grade, so a teacher is not shown a
        // mark for work that has since changed.
        grade: null,
        feedback: null,
        graded_at: null,
        graded_by: null,
      },
      { onConflict: "assignment_id,student_id" },
    )
    .select("id, content, file_url, file_name, submitted_at, updated_at, grade, feedback, graded_at")
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logAuditEvent({
    supabase: supabase as any,
    actorId: principal.userId,
    action: "assignment.submitted",
    resourceType: "assignment",
    resourceId: assignmentId,
    metadata: { courseId: course.id, hasFile: Boolean(fileUrl) },
  })

  return NextResponse.json({ submission })
}

/**
 * PATCH — a teacher grades one submission.
 *
 * Kept separate from POST so a teacher cannot rewrite the student's answer: this
 * only ever touches grade, feedback and the grading metadata.
 */
export async function PATCH(req: Request, { params }: RouteContext) {
  const { courseId, assignmentId } = await params
  const principal = await resolvePrincipal()
  if (!principal) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (principal.role !== "teacher" && principal.role !== "admin") {
    return NextResponse.json({ error: "Only a teacher may grade" }, { status: 403 })
  }

  const course = await assertCourseAccess(principal, courseId)
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const submissionId = typeof body?.submissionId === "string" ? body.submissionId : ""
  const grade = body?.grade === null || body?.grade === "" ? null : Number(body?.grade)
  const feedback = typeof body?.feedback === "string" ? body.feedback.trim() || null : null

  if (!submissionId) {
    return NextResponse.json({ error: "submissionId is required" }, { status: 400 })
  }
  if (grade !== null && (!Number.isFinite(grade) || grade < 0 || grade > 1000)) {
    return NextResponse.json({ error: "Grade must be a non-negative number" }, { status: 400 })
  }

  const supabase = await clientForPrincipal(principal)
  const isPersistableActor = principal.isPersistable

  const { data, error } = await supabase
    .from("assignment_submissions")
    .update({
      grade,
      feedback,
      graded_at: grade === null ? null : new Date().toISOString(),
      graded_by: isPersistableActor ? principal.userId : null,
    })
    .eq("id", submissionId)
    .eq("assignment_id", assignmentId)
    .select("id, grade, feedback, graded_at")
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ submission: data })
}
