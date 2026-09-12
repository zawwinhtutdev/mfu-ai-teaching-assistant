import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { extractCourseMaterialFileTexts, indexCourseMaterialContent } from "@/lib/ai/course-rag"
import { logAuditEvent } from "@/lib/server/audit-log"

const ALLOWED_MATERIAL_TYPES = new Set(["lecture", "document", "video", "other"])

function toMaterialType(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return "document"
  const normalized = value.trim().toLowerCase()
  return ALLOWED_MATERIAL_TYPES.has(normalized) ? normalized : "document"
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ courseId: string }> },
) {
  try {
    const { courseId } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    if (!profile || profile.role !== "teacher") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: course } = await supabase
      .from("courses")
      .select("id,teacher_id")
      .eq("id", courseId)
      .single()

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 })
    }

    if (course.teacher_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const form = await req.formData()
    const title = String(form.get("title") || "").trim()
    const manualContent = String(form.get("content") || "").trim()
    const materialType = toMaterialType(form.get("materialType"))
    const files = form.getAll("files").filter((item): item is File => item instanceof File)

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 })
    }

    const uploadedFiles = await Promise.all(
      files.map(async (file) => ({
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        buffer: Buffer.from(await file.arrayBuffer()),
      })),
    )

    const extractedParts = await extractCourseMaterialFileTexts(uploadedFiles)

    if (!manualContent && extractedParts.length === 0) {
      return NextResponse.json(
        {
          error: "Provide material content or upload at least one readable file (PDF/TXT/Markdown/CSV/JSON)",
        },
        { status: 400 },
      )
    }

    const extractedText = extractedParts
      .map((part) => `Source file: ${part.source}\n${part.text}`)
      .join("\n\n")

    const combinedContent = [manualContent, extractedText].filter(Boolean).join("\n\n").trim()

    const { data: insertedMaterial, error: insertError } = await supabase
      .from("course_materials")
      .insert({
        course_id: courseId,
        title,
        content: combinedContent,
        material_type: materialType,
        approval_status: "draft",
      })
      .select("*")
      .single()

    if (insertError || !insertedMaterial) {
      return NextResponse.json({ error: insertError?.message || "Failed to create material" }, { status: 500 })
    }

    try {
      const indexing = await indexCourseMaterialContent({
        supabase: supabase as any,
        courseId,
        materialId: insertedMaterial.id,
        manualContent,
        extractedParts,
      })

      return NextResponse.json({
        material: insertedMaterial,
        ingestion: {
          chunks: indexing.chunkCount,
          sourceFiles: extractedParts.map((part) => part.source),
        },
      })
    } catch (indexingError: any) {
      await supabase.from("course_materials").delete().eq("id", insertedMaterial.id)
      return NextResponse.json(
        { error: indexingError?.message || "Material indexing failed" },
        { status: 500 },
      )
    } finally {
      await logAuditEvent({
        supabase: supabase as any,
        actorId: user.id,
        action: "course_material.created",
        resourceType: "course_material",
        resourceId: insertedMaterial.id,
        metadata: {
          courseId,
          title,
          materialType,
          sourceFiles: extractedParts.map((part) => part.source),
        },
        ipAddress: req.headers.get("x-forwarded-for"),
        userAgent: req.headers.get("user-agent"),
      })
    }
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to upload material" }, { status: 500 })
  }
}
