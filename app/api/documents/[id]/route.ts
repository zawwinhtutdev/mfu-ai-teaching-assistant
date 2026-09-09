import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { deleteObjectFromSpaces } from "@/lib/storage/spaces"
import { deleteGeminiFileSearchDocument } from "@/lib/ai/gemini-file-search"
import { trackApiError } from "@/lib/server/observability"
import { DEMO_EMAIL_COOKIE, DEMO_ROLE_COOKIE, getDemoAccountByRole } from "@/lib/demo-auth"
import {
  DEMO_COOKIE_MAX_AGE_SECONDS,
  DEMO_DOCUMENTS_COOKIE,
  readDemoDocumentsCookie,
  writeDemoDocumentsCookie,
} from "@/lib/demo-documents"

export async function DELETE(
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
      const demoDocs = readDemoDocumentsCookie(cookieStore.get(DEMO_DOCUMENTS_COOKIE)?.value, demoAccount.email)
      const doc = demoDocs.find((item) => item.id === id)

      if (!doc) {
        return NextResponse.json({ error: "Document not found" }, { status: 404 })
      }

      await deleteObjectFromSpaces(doc.object_key)
      await deleteGeminiFileSearchDocument({ documentName: doc.gemini_document_name })

      const nextDocs = demoDocs.filter((item) => item.id !== id)
      const response = NextResponse.json({ success: true })
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
      .select("id, object_key, gemini_document_name")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()

    if (findError || !doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    await deleteObjectFromSpaces(doc.object_key)
    await deleteGeminiFileSearchDocument({ documentName: doc.gemini_document_name })

    const { error: deleteError } = await supabase
      .from("user_documents")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    await trackApiError({
      route: "/api/documents/[id]:DELETE",
      error,
    })
    return NextResponse.json({ error: error?.message || "Failed to delete document" }, { status: 500 })
  }
}
