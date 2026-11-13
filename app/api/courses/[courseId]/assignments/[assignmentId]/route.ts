import { NextResponse } from "next/server"

import { assertCourseAccess, clientForPrincipal, resolvePrincipal } from "@/lib/server/principal"
import { logAuditEvent } from "@/lib/server/audit-log"

type RouteContext = { params: Promise<{ courseId: string; assignmentId: string }> }

/** Edit or release an assignment. Teachers of the course only. */
export async function PATCH(req: Request, { params }: RouteContext) {
  const { courseId, assignmentId } = await params
  const principal = await resolvePrincipal()
  if (!principal) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (principal.role === "student") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const course = await assertCourseAccess(principal, courseId)
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (typeof body?.title === "string") {
    const title = body.title.trim()
    if (!title) return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 })
    update.title = title
  }

  if (typeof body?.instructions === "string") {
    update.instructions = body.instructions.trim() || null
  }

  if (body?.dueAt !== undefined) {
    if (body.dueAt === null || body.dueAt === "") {
      update.due_at = null
    } else {
      const parsed = new Date(String(body.dueAt))
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: "dueAt is not a valid date" }, { status: 400 })
      }
      update.due_at = parsed.toISOString()
    }
  }

  if (body?.points !== undefined) {
    if (body.points === null || body.points === "") {
      update.points = null
    } else {
      const points = Number(body.points)
      if (!Number.isFinite(points) || points < 0) {
        return NextResponse.json({ error: "points must be a non-negative number" }, { status: 400 })
      }
      update.points = points
    }
  }

  if (typeof body?.visibleToStudents === "boolean") {
    update.visible_to_students = body.visibleToStudents
  }

  const supabase = await clientForPrincipal(principal)
  const { data, error } = await supabase
    .from("assignments")
    .update(update)
    .eq("id", assignmentId)
    .eq("course_id", course.id)
    .select("id, course_id, title, instructions, due_at, points, visible_to_students, created_at")
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Assignment not found" }, { status: 404 })

  await logAuditEvent({
    supabase: supabase as any,
    actorId: principal.isPersistable ? principal.userId : null,
    action: "assignment.updated",
    resourceType: "assignment",
    resourceId: data.id,
    metadata: { courseId: course.id, fields: Object.keys(update) },
  })

  return NextResponse.json({ assignment: data })
}

/** Delete an assignment. Derived reminders cascade via the FK. */
export async function DELETE(_req: Request, { params }: RouteContext) {
  const { courseId, assignmentId } = await params
  const principal = await resolvePrincipal()
  if (!principal) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (principal.role === "student") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const course = await assertCourseAccess(principal, courseId)
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 })

  const supabase = await clientForPrincipal(principal)
  const { error } = await supabase
    .from("assignments")
    .delete()
    .eq("id", assignmentId)
    .eq("course_id", course.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAuditEvent({
    supabase: supabase as any,
    actorId: principal.isPersistable ? principal.userId : null,
    action: "assignment.deleted",
    resourceType: "assignment",
    resourceId: assignmentId,
    metadata: { courseId: course.id },
  })

  return NextResponse.json({ deleted: true })
}
