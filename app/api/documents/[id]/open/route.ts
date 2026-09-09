import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getDocumentReadUrl } from "@/lib/storage/spaces"
import { trackApiError } from "@/lib/server/observability"
import { DEMO_EMAIL_COOKIE, DEMO_ROLE_COOKIE, getDemoAccountByRole } from "@/lib/demo-auth"
import { DEMO_DOCUMENTS_COOKIE, readDemoDocumentsCookie } from "@/lib/demo-documents"

interface DocumentAccess {
  fileName: string
  mimeType: string | null
  objectKey: string
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const demoRole = cookieStore.get(DEMO_ROLE_COOKIE)?.value
    const demoEmail = cookieStore.get(DEMO_EMAIL_COOKIE)?.value
    const demoAccount = getDemoAccountByRole(demoRole)

    let access: DocumentAccess | null = null

    if (demoAccount && demoEmail && demoEmail.toLowerCase() === demoAccount.email.toLowerCase()) {
      const docs = readDemoDocumentsCookie(cookieStore.get(DEMO_DOCUMENTS_COOKIE)?.value, demoAccount.email)
      const doc = docs.find((item) => item.id === id)
      if (!doc) {
        return NextResponse.json({ error: "Document not found" }, { status: 404 })
      }
      access = {
        fileName: doc.file_name,
        mimeType: doc.mime_type,
        objectKey: doc.object_key,
      }
    } else {
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }

      const { data: doc, error } = await supabase
        .from("user_documents")
        .select("file_name, mime_type, object_key")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle()

      if (error || !doc) {
        return NextResponse.json({ error: "Document not found" }, { status: 404 })
      }

      access = {
        fileName: doc.file_name,
        mimeType: doc.mime_type,
        objectKey: doc.object_key,
      }
    }

    const readUrl = await getDocumentReadUrl(access.objectKey, 120)
    const range = req.headers.get("range")
    const upstream = await fetch(readUrl, {
      headers: range ? { range } : undefined,
    })

    if (!upstream.ok) {
      return NextResponse.json({ error: "Failed to load document" }, { status: 502 })
    }

    const headers = new Headers()
    headers.set("Content-Type", access.mimeType || upstream.headers.get("content-type") || "application/octet-stream")
    headers.set("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(access.fileName)}`)
    headers.set("Cache-Control", "private, no-store, max-age=0")

    const contentLength = upstream.headers.get("content-length")
    if (contentLength) headers.set("Content-Length", contentLength)
    const contentRange = upstream.headers.get("content-range")
    if (contentRange) headers.set("Content-Range", contentRange)
    const acceptRanges = upstream.headers.get("accept-ranges")
    if (acceptRanges) headers.set("Accept-Ranges", acceptRanges)

    if (!upstream.body) {
      const buffer = await upstream.arrayBuffer()
      return new Response(buffer, { status: 200, headers })
    }

    return new Response(upstream.body, { status: upstream.status, headers })
  } catch (error: any) {
    await trackApiError({
      route: "/api/documents/[id]/open:GET",
      error,
    })
    return NextResponse.json({ error: error?.message || "Failed to open document" }, { status: 500 })
  }
}
