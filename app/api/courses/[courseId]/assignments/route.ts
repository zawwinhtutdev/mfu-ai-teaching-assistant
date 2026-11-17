import { NextResponse } from "next/server"

import { assertCourseAccess, clientForPrincipal, resolvePrincipal } from "@/lib/server/principal"
import { logAuditEvent } from "@/lib/server/audit-log"

/**
 * Assignments for one course (spec §4).
 *
 * Teachers read and write every assignment in a course they own; students read
 * only those released to them. The RLS policies enforce the same rules, so this
 * route is a thin, explicit layer rather than the only guard.
 */

type RouteContext = { params: Promise<{ courseId: string }> }

export async function GET(_req: Request, { params }: RouteContext) {
  const { courseId } = await params
  const principal = await resolvePrincipal()
  if (!principal) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const course = await assertCourseAccess(principal, courseId)
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 })

  const supabase = await clientForPrincipal(principal)
  const { data, error } = await supabase
    .from("assignments")
    .select("id, course_id, title, instructions, due_at, points, visible_to_students, created_at")
    .eq("course_id", course.id)
    .order("due_at", { ascending: true, nullsFirst: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Students never see drafts. Filtering here as well as in RLS keeps the
  // behaviour identical for demo sessions, which read through a privileged
  // client that bypasses RLS.
  const assignments =
    principal.role === "student"
      ? (data || []).filter((assignment: any) => assignment.visible_to_students)
      : data || []

  return NextResponse.json({ assignments })
}

export async function POST(req: Request, { params }: RouteContext) {
  const { courseId } = await params
  const principal = await resolvePrincipal()
  if (!principal) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (principal.role === "student") {
    return NextResponse.json({ error: "Only teachers can create assignments" }, { status: 403 })
  }

  const course = await assertCourseAccess(principal, courseId)
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const title = String(body?.title || "").trim()
  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 })
  }

  const dueAtRaw = body?.dueAt ? String(body.dueAt) : ""
  let dueAt: string | null = null
  if (dueAtRaw) {
    const parsed = new Date(dueAtRaw)
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "dueAt is not a valid date" }, { status: 400 })
    }
    dueAt = parsed.toISOString()
  }

  const pointsRaw = body?.points
  const points =
    pointsRaw === null || pointsRaw === undefined || pointsRaw === ""
      ? null
      : Number(pointsRaw)

  if (points !== null && (!Number.isFinite(points) || points < 0)) {
    return NextResponse.json({ error: "points must be a non-negative number" }, { status: 400 })
  }

  const supabase = await clientForPrincipal(principal)
  const { data, error } = await supabase
    .from("assignments")
    .insert({
      course_id: course.id,
      title,
      instructions: String(body?.instructions || "").trim() || null,
      due_at: dueAt,
      points,
      visible_to_students: body?.visibleToStudents !== false,
      // Demo principals have no profiles row, so the FK would reject the write.
      created_by: principal.isPersistable ? principal.userId : null,
    })
    .select("id, course_id, title, instructions, due_at, points, visible_to_students, created_at")
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Failed to create assignment" }, { status: 500 })
  }

  await logAuditEvent({
    supabase: supabase as any,
    actorId: principal.isPersistable ? principal.userId : null,
    action: "assignment.created",
    resourceType: "assignment",
    resourceId: data.id,
    metadata: { courseId: course.id, title, dueAt },
  })

  return NextResponse.json({ assignment: data })
}
