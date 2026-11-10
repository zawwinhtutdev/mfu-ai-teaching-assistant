import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { deleteObjectFromSpaces, uploadUserDocumentToSpaces } from "@/lib/storage/spaces"
import { getUserGeminiFileSearchStoreName, indexDocumentToGeminiFileSearch } from "@/lib/ai/gemini-file-search"
import {
  DOCUMENT_UPLOAD_FORMATS_LABEL,
  MAX_DOCUMENT_UPLOAD_BYTES,
  isSupportedDocument,
  resolveDocumentMimeType,
} from "@/lib/documents/supported-formats"
import { trackApiError } from "@/lib/server/observability"
import { isHttpsRequest } from "@/lib/server/request-security"
import { DEMO_EMAIL_COOKIE, DEMO_ROLE_COOKIE, getDemoAccountByRole } from "@/lib/demo-auth"
import {
  DEMO_COOKIE_MAX_AGE_SECONDS,
  DEMO_DOCUMENTS_COOKIE,
  type DemoDocumentRecord,
  getLatestReadyDemoStoreName,
  readDemoDocumentsCookie,
  writeDemoDocumentsCookie,
} from "@/lib/demo-documents"

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

export async function GET() {
  try {
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
      const demoDocuments = readDemoDocumentsCookie(cookieStore.get(DEMO_DOCUMENTS_COOKIE)?.value, demoAccount.email)
      const documents = demoDocuments.map((doc) => formatDocumentForClient(doc))
      return NextResponse.json({ documents })
    }

    const supabase = await createClient()
    // PERFORMANCE: Use getSession() instead of getUser() to avoid a ~200-400ms
    // network round-trip to Supabase Auth on every page load. The middleware
    // already validates the session. getSession() reads the JWT locally.
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const user = session.user

    const { data, error } = await supabase
      .from("user_documents")
      .select(
        "id, file_name, mime_type, size_bytes, object_key, bucket, region, created_at, gemini_store_name, gemini_document_name, gemini_index_status, gemini_index_error, gemini_indexed_at",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const documents = (data || []).map((doc) => formatDocumentForClient(doc))

    return NextResponse.json({ documents })
  } catch (error: any) {
    await trackApiError({
      route: "/api/documents:GET",
      error,
    })
    return NextResponse.json({ error: error?.message || "Failed to load documents" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const demoRole = cookieStore.get(DEMO_ROLE_COOKIE)?.value
    const demoEmail = cookieStore.get(DEMO_EMAIL_COOKIE)?.value
    const demoAccount = getDemoAccountByRole(demoRole)
    const isDemoSession = !!(
      demoAccount &&
      demoEmail &&
      demoEmail.toLowerCase() === demoAccount.email.toLowerCase()
    )

    const form = await req.formData()
    const files = form.getAll("files").filter((item): item is File => item instanceof File)

    if (files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 })
    }

    const unsupportedFile = files.find((file) => !isSupportedDocument(file.name, file.type))
    if (unsupportedFile) {
      return NextResponse.json(
        { error: `${unsupportedFile.name} is not supported. Accepted formats: ${DOCUMENT_UPLOAD_FORMATS_LABEL}.` },
        { status: 400 },
      )
    }

    const uploadSize = files.reduce((total, file) => total + file.size, 0)
    if (uploadSize > MAX_DOCUMENT_UPLOAD_BYTES) {
      return NextResponse.json({ error: "The selected files exceed the 4 MB upload limit." }, { status: 400 })
    }

    if (isDemoSession && demoAccount) {
      const existingDocs = readDemoDocumentsCookie(cookieStore.get(DEMO_DOCUMENTS_COOKIE)?.value, demoAccount.email)
      let currentGeminiStoreName = getLatestReadyDemoStoreName(existingDocs)
      const newDocs: DemoDocumentRecord[] = []

      for (const file of files) {
        const buffer = Buffer.from(await file.arrayBuffer())
        const mimeType = resolveDocumentMimeType(file.name, file.type)
        const uploaded = await uploadUserDocumentToSpaces({
          userId: demoAccount.profileId,
          userEmail: demoAccount.email,
          userLabel: demoAccount.fullName,
          fileName: file.name,
          buffer,
          contentType: mimeType,
        })

        const geminiIndex = await indexDocumentToGeminiFileSearch({
          supabase: null,
          userId: demoAccount.profileId,
          fileName: file.name,
          mimeType,
          fileBuffer: buffer,
          existingStoreName: currentGeminiStoreName,
        })

        if (geminiIndex.storeName) {
          currentGeminiStoreName = geminiIndex.storeName
        }

        newDocs.push({
          id: `demo-doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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
          created_at: new Date().toISOString(),
        })
      }

      const merged = [...newDocs, ...existingDocs]
      const responseDocs = newDocs.map((doc) => formatDocumentForClient(doc))

      const response = NextResponse.json({ documents: responseDocs })
      response.cookies.set(DEMO_DOCUMENTS_COOKIE, writeDemoDocumentsCookie(demoAccount.email, merged), {
        httpOnly: true,
        secure: await isHttpsRequest(),
        sameSite: "lax",
        path: "/",
        maxAge: DEMO_COOKIE_MAX_AGE_SECONDS,
      })
      return response
    }

    const supabase = await createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const user = session.user

    const documents = []
    let currentGeminiStoreName = await getUserGeminiFileSearchStoreName(supabase as any, user.id)

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer())
      const mimeType = resolveDocumentMimeType(file.name, file.type)
      const uploaded = await uploadUserDocumentToSpaces({
        userId: user.id,
        userEmail: user.email || undefined,
        userLabel: user.user_metadata?.full_name || undefined,
        fileName: file.name,
        buffer,
        contentType: mimeType,
      })

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

      const { data: inserted, error: insertError } = await supabase
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
          "id, file_name, mime_type, size_bytes, object_key, bucket, region, created_at, gemini_store_name, gemini_document_name, gemini_index_status, gemini_index_error, gemini_indexed_at",
        )
        .single()

      if (insertError) {
        await deleteObjectFromSpaces(uploaded.objectKey).catch(() => undefined)
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }

      documents.push(formatDocumentForClient(inserted))
    }

    return NextResponse.json({ documents })
  } catch (error: any) {
    await trackApiError({
      route: "/api/documents:POST",
      error,
    })
    return NextResponse.json({ error: error?.message || "Failed to upload documents" }, { status: 500 })
  }
}
