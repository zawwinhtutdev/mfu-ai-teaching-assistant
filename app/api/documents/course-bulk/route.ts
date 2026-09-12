import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { indexDocumentToGeminiFileSearch } from "@/lib/ai/gemini-file-search"
import { extractCourseMaterialFileTexts, indexCourseMaterialContent } from "@/lib/ai/course-rag"
import { trackApiError } from "@/lib/server/observability"
import { uploadUserDocumentToSpaces, deleteObjectFromSpaces } from "@/lib/storage/spaces"
import { DEMO_EMAIL_COOKIE, DEMO_ROLE_COOKIE, getDemoAccountByRole } from "@/lib/demo-auth"
import {
  DEMO_COOKIE_MAX_AGE_SECONDS,
  DEMO_DOCUMENTS_COOKIE,
  type DemoDocumentRecord,
  getLatestReadyDemoStoreName,
  readDemoDocumentsCookie,
  writeDemoDocumentsCookie,
} from "@/lib/demo-documents"
import { mockTeacherCourses } from "@/lib/mock-data"

export const maxDuration = 120

function formatDocumentForClient(doc: {
  id: string
  file_name: string
  mime_type: string | null
  size_bytes: number
  created_at: string
  gemini_store_name?: string | null
  gemini_document_name?: string | null
  gemini_index_status?: "pending" | "ready" | "failed" | "skipped"
  gemini_index_error?: string | null
  gemini_indexed_at?: string | null
}) {
  return {
    id: doc.id,
    file_name: doc.file_name,
    mime_type: doc.mime_type,
    size_bytes: doc.size_bytes,
    created_at: doc.created_at,
    gemini_store_name: doc.gemini_store_name,
    gemini_document_name: doc.gemini_document_name,
    gemini_index_status: doc.gemini_index_status,
    gemini_index_error: doc.gemini_index_error,
    gemini_indexed_at: doc.gemini_indexed_at,
    url: `/api/documents/${doc.id}/open`,
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const form = await req.formData()
    const courseId = String(form.get("courseId") || "").trim()
    const files = form.getAll("files").filter((item): item is File => item instanceof File)

    if (!courseId) {
      return NextResponse.json({ error: "courseId is required" }, { status: 400 })
    }

    if (files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 })
    }

    const demoRole = cookieStore.get(DEMO_ROLE_COOKIE)?.value
    const demoEmail = cookieStore.get(DEMO_EMAIL_COOKIE)?.value
    const demoAccount = getDemoAccountByRole(demoRole)
    const isDemoTeacher = !!(
      demoAccount &&
      demoRole === "teacher" &&
      demoEmail &&
      demoEmail.toLowerCase() === demoAccount.email.toLowerCase()
    )

    if (isDemoTeacher && demoAccount) {
      const targetCourse = mockTeacherCourses.find((course) => course.id === courseId)
      if (!targetCourse) {
        return NextResponse.json({ error: "Course not found" }, { status: 404 })
      }

      const existingDocs = readDemoDocumentsCookie(cookieStore.get(DEMO_DOCUMENTS_COOKIE)?.value, demoAccount.email)
      let currentGeminiStoreName = getLatestReadyDemoStoreName(existingDocs)
      const newDocs: DemoDocumentRecord[] = []

      for (const file of files) {
        const buffer = Buffer.from(await file.arrayBuffer())
        const uploaded = await uploadUserDocumentToSpaces({
          userId: demoAccount.profileId,
          userEmail: demoAccount.email,
          userLabel: demoAccount.fullName,
          fileName: file.name,
          buffer,
          contentType: file.type || "application/octet-stream",
        })

        const geminiIndex = await indexDocumentToGeminiFileSearch({
          supabase: null,
          userId: demoAccount.profileId,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          fileBuffer: buffer,
          existingStoreName: currentGeminiStoreName,
        })

        if (geminiIndex.storeName) {
          currentGeminiStoreName = geminiIndex.storeName
        }

        newDocs.push({
          id: `demo-doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          file_name: file.name,
          mime_type: file.type || "application/octet-stream",
          size_bytes: file.size,
          object_key: uploaded.objectKey,
          bucket: uploaded.bucket,
          region: uploaded.region,
          gemini_store_name: geminiIndex.storeName,
          gemini_document_name: geminiIndex.documentName,
          gemini_index_status: geminiIndex.status,
          gemini_index_error: geminiIndex.error,
          gemini_indexed_at: geminiIndex.status === "ready" ? new Date().toISOString() : null,
          created_at: new Date().toISOString(),
        })
      }

      const merged = [...newDocs, ...existingDocs]
      const responseDocs = newDocs.map((doc) => formatDocumentForClient(doc))
      const response = NextResponse.json({
        documents: responseDocs,
        linkedCourseId: courseId,
        note: "Demo teacher bulk upload linked to Documents RAG.",
      })
      response.cookies.set(DEMO_DOCUMENTS_COOKIE, writeDemoDocumentsCookie(demoAccount.email, merged), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: DEMO_COOKIE_MAX_AGE_SECONDS,
      })
      return response
    }

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
      .select("id, teacher_id")
      .eq("id", courseId)
      .maybeSingle()

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 })
    }

    if (course.teacher_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    let currentGeminiStoreName: string | null = null
    const documents: any[] = []
    let chunkCount = 0

    const insertedDocumentIds: string[] = []
    const uploadedObjectKeys: string[] = []
    const insertedMaterialIds: string[] = []

    try {
      for (const file of files) {
        const buffer = Buffer.from(await file.arrayBuffer())
        const mimeType = file.type || "application/octet-stream"

        const uploaded = await uploadUserDocumentToSpaces({
          userId: user.id,
          userEmail: user.email || undefined,
          userLabel: user.user_metadata?.full_name || undefined,
          fileName: file.name,
          buffer,
          contentType: mimeType,
        })
        uploadedObjectKeys.push(uploaded.objectKey)

        const geminiIndex = await indexDocumentToGeminiFileSearch({
          supabase: supabase as any,
          userId: user.id,
          fileName: file.name,
          mimeType,
          fileBuffer: buffer,
          existingStoreName: currentGeminiStoreName,
        })
        if (geminiIndex.storeName) {
          currentGeminiStoreName = geminiIndex.storeName
        }

        const { data: insertedDoc, error: insertDocError } = await supabase
          .from("user_documents")
          .insert({
            user_id: user.id,
            file_name: file.name,
            mime_type: mimeType,
            size_bytes: file.size,
            object_key: uploaded.objectKey,
            bucket: uploaded.bucket,
            region: uploaded.region,
            gemini_store_name: geminiIndex.storeName,
            gemini_document_name: geminiIndex.documentName,
            gemini_index_status: geminiIndex.status,
            gemini_index_error: geminiIndex.error,
            gemini_indexed_at: geminiIndex.status === "ready" ? new Date().toISOString() : null,
          })
          .select(
            "id, file_name, mime_type, size_bytes, created_at, gemini_store_name, gemini_document_name, gemini_index_status, gemini_index_error, gemini_indexed_at",
          )
          .single()

        if (insertDocError || !insertedDoc) {
          throw new Error(insertDocError?.message || "Failed to save document")
        }
        insertedDocumentIds.push(insertedDoc.id)
        documents.push(formatDocumentForClient(insertedDoc))

        const extractedParts = await extractCourseMaterialFileTexts([
          {
            fileName: file.name,
            mimeType,
            buffer,
          },
        ])

        const fallbackContent = `Source file: ${file.name}\nUploaded as course material via bulk Documents RAG upload.`
        const combinedContent = extractedParts.length
          ? extractedParts.map((part) => `Source file: ${part.source}\n${part.text}`).join("\n\n")
          : fallbackContent

        const { data: insertedMaterial, error: insertMaterialError } = await supabase
          .from("course_materials")
          .insert({
            course_id: courseId,
            title: file.name.replace(/\.[^.]+$/, ""),
            content: combinedContent,
            material_type: "document",
          })
          .select("id")
          .single()

        if (insertMaterialError || !insertedMaterial) {
          throw new Error(insertMaterialError?.message || "Failed to create course material")
        }
        insertedMaterialIds.push(insertedMaterial.id)

        const indexing = await indexCourseMaterialContent({
          supabase: supabase as any,
          courseId,
          materialId: insertedMaterial.id,
          manualContent: "",
          extractedParts,
        })
        chunkCount += indexing.chunkCount
      }
    } catch (innerError) {
      if (insertedDocumentIds.length > 0) {
        await supabase.from("user_documents").delete().in("id", insertedDocumentIds).eq("user_id", user.id)
      }
      if (insertedMaterialIds.length > 0) {
        await supabase.from("course_materials").delete().in("id", insertedMaterialIds).eq("course_id", courseId)
      }
      await Promise.all(uploadedObjectKeys.map((key) => deleteObjectFromSpaces(key).catch(() => undefined)))
      throw innerError
    }

    return NextResponse.json({
      documents,
      linkedCourseId: courseId,
      ingestion: {
        files: files.length,
        chunks: chunkCount,
      },
    })
  } catch (error: any) {
    await trackApiError({
      route: "/api/documents/course-bulk:POST",
      error,
    })
    return NextResponse.json({ error: error?.message || "Bulk upload failed" }, { status: 500 })
  }
}
