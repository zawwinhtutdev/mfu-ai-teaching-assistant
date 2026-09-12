import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { getDocumentReadUrl } from "@/lib/storage/spaces"
import { getUserGeminiFileSearchStoreName, indexDocumentToGeminiFileSearch } from "@/lib/ai/gemini-file-search"
import { resolveDocumentMimeType } from "@/lib/documents/supported-formats"
import { trackApiError } from "@/lib/server/observability"
import { DEMO_EMAIL_COOKIE, DEMO_ROLE_COOKIE, getDemoAccountByRole } from "@/lib/demo-auth"
import {
  DEMO_COOKIE_MAX_AGE_SECONDS,
  DEMO_DOCUMENTS_COOKIE,
  type DemoDocumentRecord,
  getLatestReadyDemoStoreName,
  readDemoDocumentsCookie,
  writeDemoDocumentsCookie,
} from "@/lib/demo-documents"

async function downloadBufferByObjectKey(objectKey: string) {
  const readUrl = await getDocumentReadUrl(objectKey, 300)
  const response = await fetch(readUrl)
  if (!response.ok) {
    throw new Error(`Failed to read file from storage (${response.status})`)
  }
  return Buffer.from(await response.arrayBuffer())
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const demoRole = cookieStore.get(DEMO_ROLE_COOKIE)?.value
    const demoEmail = cookieStore.get(DEMO_EMAIL_COOKIE)?.value
    const demoAccount = getDemoAccountByRole(demoRole)
    const isDemoSession = !!(
      demoAccount &&
      demoEmail &&
      demoEmail.toLowerCase() === demoAccount.email.toLowerCase()
    )

    if (isDemoSession && demoAccount) {
      const docs = readDemoDocumentsCookie(cookieStore.get(DEMO_DOCUMENTS_COOKIE)?.value, demoAccount.email)
      const target = docs.find((item) => item.id === id)
      if (!target) {
        return NextResponse.json({ error: "Document not found" }, { status: 404 })
      }

      const buffer = await downloadBufferByObjectKey(target.object_key)
      const existingStoreName =
        target.gemini_store_name ||
        getLatestReadyDemoStoreName(docs) ||
        null
      const geminiIndex = await indexDocumentToGeminiFileSearch({
        supabase: null,
        userId: demoAccount.profileId,
        fileName: target.file_name,
        mimeType: resolveDocumentMimeType(target.file_name, target.mime_type),
        fileBuffer: buffer,
        existingStoreName,
      })

      const nowIso = new Date().toISOString()
      const nextDocs: DemoDocumentRecord[] = docs.map((item) =>
        item.id === id
          ? {
              ...item,
              gemini_store_name: geminiIndex.storeName,
              gemini_document_name: geminiIndex.documentName,
              gemini_index_status: geminiIndex.status,
              gemini_index_error: geminiIndex.error,
              gemini_indexed_at: geminiIndex.status === "ready" ? nowIso : item.gemini_indexed_at || null,
            }
          : item,
      )
      const updated = nextDocs.find((item) => item.id === id)!
      const response = NextResponse.json({
        document: {
          id: updated.id,
          file_name: updated.file_name,
          mime_type: updated.mime_type,
          size_bytes: updated.size_bytes,
          created_at: updated.created_at,
          gemini_store_name: updated.gemini_store_name,
          gemini_document_name: updated.gemini_document_name,
          gemini_index_status: updated.gemini_index_status,
          gemini_index_error: updated.gemini_index_error,
          gemini_indexed_at: updated.gemini_indexed_at,
          url: `/api/documents/${updated.id}/open`,
        },
      })
      response.cookies.set(DEMO_DOCUMENTS_COOKIE, writeDemoDocumentsCookie(demoAccount.email, nextDocs), {
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

    const { data: doc, error: findError } = await supabase
      .from("user_documents")
      .select(
        "id, file_name, mime_type, size_bytes, object_key, bucket, region, created_at, gemini_store_name, gemini_document_name, gemini_index_status, gemini_index_error, gemini_indexed_at",
      )
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle()

    if (findError || !doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    const buffer = await downloadBufferByObjectKey(doc.object_key)
    const existingStoreName = doc.gemini_store_name || (await getUserGeminiFileSearchStoreName(supabase as any, user.id))
    const geminiIndex = await indexDocumentToGeminiFileSearch({
      supabase: supabase as any,
      userId: user.id,
      fileName: doc.file_name,
      mimeType: resolveDocumentMimeType(doc.file_name, doc.mime_type),
      fileBuffer: buffer,
      existingStoreName,
    })

    const { data: updated, error: updateError } = await supabase
      .from("user_documents")
      .update({
        gemini_store_name: geminiIndex.storeName,
        gemini_document_name: geminiIndex.documentName,
        gemini_index_status: geminiIndex.status,
        gemini_index_error: geminiIndex.error,
        gemini_indexed_at: geminiIndex.status === "ready" ? new Date().toISOString() : doc.gemini_indexed_at,
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select(
        "id, file_name, mime_type, size_bytes, object_key, bucket, region, created_at, gemini_store_name, gemini_document_name, gemini_index_status, gemini_index_error, gemini_indexed_at",
      )
      .single()

    if (updateError || !updated) {
      return NextResponse.json({ error: updateError?.message || "Failed to update index status" }, { status: 500 })
    }

    return NextResponse.json({
      document: {
        id: updated.id,
        file_name: updated.file_name,
        mime_type: updated.mime_type,
        size_bytes: updated.size_bytes,
        created_at: updated.created_at,
        gemini_store_name: updated.gemini_store_name,
        gemini_document_name: updated.gemini_document_name,
        gemini_index_status: updated.gemini_index_status,
        gemini_index_error: updated.gemini_index_error,
        gemini_indexed_at: updated.gemini_indexed_at,
        url: `/api/documents/${updated.id}/open`,
      },
    })
  } catch (error: any) {
    await trackApiError({
      route: "/api/documents/[id]/reindex:POST",
      error,
    })
    return NextResponse.json({ error: error?.message || "Failed to re-index document" }, { status: 500 })
  }
}
