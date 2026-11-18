import { NextResponse } from "next/server"

import { assertCourseAccess, clientForPrincipal, resolvePrincipal } from "@/lib/server/principal"
import { logAuditEvent } from "@/lib/server/audit-log"

/**
 * PATCH /api/courses/[courseId]/materials/[materialId]
 *
 * Update the material's title or its approval status. Only a teacher who owns
 * the course (or an admin) may do either, which matters because
 * `approval_status` is what the RLS gate reads: a student able to flip it would
 * be able to publish their own course content.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ courseId: string; materialId: string }> },
) {
  try {
    const { courseId, materialId } = await params
    const principal = await resolvePrincipal()

    if (!principal) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const course = await assertCourseAccess(principal, courseId)
    if (!course) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // assertCourseAccess admits enrolled students too; only the owner may write.
    const isOwner = principal.role === "admin" || principal.role === "teacher"
    if (!isOwner) {
      return NextResponse.json({ error: "Only the course teacher may change this material" }, { status: 403 })
    }

    const body = await req.json()
    const updateData: Record<string, any> = {}

    if (body.approval_status) {
      if (!["draft", "approved", "published"].includes(body.approval_status)) {
        return NextResponse.json(
          { error: "approval_status must be draft, approved, or published" },
          { status: 400 },
        )
      }
      updateData.approval_status = body.approval_status
    }

    if (typeof body.title === "string" && body.title.trim()) {
      updateData.title = body.title.trim()
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }

    const supabase = await clientForPrincipal(principal)

    const { data: material, error } = await supabase
      .from("course_materials")
      .update(updateData)
      .eq("id", materialId)
      .eq("course_id", course.id)
      .select("id, title, approval_status")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await logAuditEvent({
      supabase,
      actorId: principal.isPersistable ? principal.userId : null,
      action: "material.update",
      resourceType: "course_material",
      resourceId: materialId,
      metadata: { courseId: course.id, changes: updateData },
    })

    return NextResponse.json({ material })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to update material" }, { status: 500 })
  }
}

/**
 * DELETE /api/courses/[courseId]/materials/[materialId]
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ courseId: string; materialId: string }> },
) {
  try {
    const { courseId, materialId } = await params
    const principal = await resolvePrincipal()

    if (!principal) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const course = await assertCourseAccess(principal, courseId)
    if (!course || (principal.role !== "admin" && principal.role !== "teacher")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const supabase = await clientForPrincipal(principal)

    const { error } = await supabase
      .from("course_materials")
      .delete()
      .eq("id", materialId)
      .eq("course_id", course.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await logAuditEvent({
      supabase,
      actorId: principal.isPersistable ? principal.userId : null,
      action: "material.delete",
      resourceType: "course_material",
      resourceId: materialId,
      metadata: { courseId: course.id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to delete material" }, { status: 500 })
  }
}
