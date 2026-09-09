import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * PATCH /api/courses/[courseId]/materials/[materialId]
 * Update material approval status
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ courseId: string; materialId: string }> },
) {
  try {
    const { courseId, materialId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify teacher owns the course
    const { data: course } = await supabase
      .from("courses")
      .select("id")
      .eq("id", courseId)
      .eq("teacher_id", user.id)
      .single()

    if (!course) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const updateData: Record<string, any> = {}

    if (body.approval_status) {
      if (!["draft", "approved", "published"].includes(body.approval_status)) {
        return NextResponse.json(
          { error: "approval_status must be draft, approved, or published" },
          { status: 400 }
        )
      }
      updateData.approval_status = body.approval_status
    }

    if (body.title) {
      updateData.title = body.title.trim()
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }

    const { data: material, error } = await supabase
      .from("course_materials")
      .update(updateData)
      .eq("id", materialId)
      .eq("course_id", courseId)
      .select("id, title, approval_status")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ material })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to update material" }, { status: 500 })
  }
}

/**
 * DELETE /api/courses/[courseId]/materials/[materialId]
 * Delete a material
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ courseId: string; materialId: string }> },
) {
  try {
    const { courseId, materialId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: course } = await supabase
      .from("courses")
      .select("id")
      .eq("id", courseId)
      .eq("teacher_id", user.id)
      .single()

    if (!course) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { error } = await supabase
      .from("course_materials")
      .delete()
      .eq("id", materialId)
      .eq("course_id", courseId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to delete material" }, { status: 500 })
  }
}
