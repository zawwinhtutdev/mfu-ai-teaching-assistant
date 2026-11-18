import { NextResponse } from "next/server"
import { extractCourseMaterialFileTexts, indexCourseMaterialContent } from "@/lib/ai/course-rag"
import { logAuditEvent } from "@/lib/server/audit-log"
import { assertCourseAccess, clientForPrincipal, resolvePrincipal } from "@/lib/server/principal"

const ALLOWED_MATERIAL_TYPES = new Set(["lecture", "document", "video", "other"])

function toMaterialType(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return "document"
  const normalized = value.trim().toLowerCase()
  return ALLOWED_MATERIAL_TYPES.has(normalized) ? normalized : "document"
}

/**
 * GET /api/courses/[courseId]/materials
 *
 * Lists materials the caller may read. The RLS policy decides what "may read"
 * means (students only see published rows), so this filters nothing itself.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ courseId: string }> },
) {
  try {
    const principal = await resolvePrincipal()
    if (!principal) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { courseId } = await params
    const course = await assertCourseAccess(principal, courseId)
    if (!course) {
      return NextResponse.json({ error: "You do not have access to this course" }, { status: 403 })
    }

    const supabase = await clientForPrincipal(principal)
    const { data: materials, error } = await supabase
      .from("course_materials")
      .select("id, course_id, title, content, file_url, material_type, approval_status, created_at, updated_at")
      .eq("course_id", course.id)
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ materials: materials || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to load materials" }, { status: 500 })
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ courseId: string }> },
) {
  try {
    const { courseId } = await params
    const principal = await resolvePrincipal()

    if (!principal) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (principal.role !== "teacher" && principal.role !== "admin") {
      return NextResponse.json({ error: "Only the course teacher may upload materials" }, { status: 403 })
    }

    const course = await assertCourseAccess(principal, courseId)
    if (!course) {
      return NextResponse.json({ error: "You do not have access to this course" }, { status: 403 })
    }

    const supabase = await clientForPrincipal(principal)

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

    // Keep the original file so it can be opened again. Before this, the PDF was
    // read for text and thrown away: `file_url` stayed null and the card showed
    // extracted text with no way back to the source document.
    const fileUrl = await storeMaterialFile(supabase, course.id, uploadedFiles)

    const { data: insertedMaterial, error: insertError } = await supabase
      .from("course_materials")
      .insert({
        course_id: course.id,
        title,
        content: combinedContent,
        material_type: materialType,
        file_url: fileUrl,
        // A teacher uploading their own material expects students to see it.
        // This used to default to "draft", and the RLS gate hides drafts from
        // students — so every upload silently vanished from the student view.
        // The approval gate is now opt-in via the Content Review panel.
        approval_status: "published",
      })
      .select("*")
      .single()

    if (insertError || !insertedMaterial) {
      return NextResponse.json({ error: insertError?.message || "Failed to create material" }, { status: 500 })
    }

    try {
      const indexing = await indexCourseMaterialContent({
        supabase: supabase as any,
        courseId: course.id,
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
        actorId: principal.isPersistable ? principal.userId : null,
        action: "course_material.created",
        resourceType: "course_material",
        resourceId: insertedMaterial.id,
        metadata: {
          courseId: course.id,
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

/**
 * Persist the uploaded file in the `knowledge` bucket and return its public URL.
 *
 * Only the first file is stored against the material: `file_url` is a single
 * column, and the dialog accepts several files mainly to concatenate their text.
 * Returning null on failure keeps the material usable — a teacher who uploaded a
 * 30 MB scan should still get the indexed text even if the original could not be
 * kept.
 */
async function storeMaterialFile(
  supabase: any,
  courseId: string,
  files: Array<{ fileName: string; mimeType: string; buffer: Buffer }>,
): Promise<string | null> {
  const first = files[0]
  if (!first) return null

  // Path is namespaced by course so the storage policy can verify ownership.
  const safeName = first.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")
  const path = `${courseId}/${Date.now()}-${safeName}`

  const { error } = await supabase.storage.from("knowledge").upload(path, first.buffer, {
    contentType: first.mimeType || "application/octet-stream",
    upsert: false,
  })

  if (error) {
    console.error("[materials] could not store the original file:", error.message)
    return null
  }

  const { data } = supabase.storage.from("knowledge").getPublicUrl(path)
  return data?.publicUrl ?? null
}
