import { NextResponse } from "next/server"

import { API_URL, canManageMaterials, serviceHeaders } from "@/lib/api-service"
import { createClient } from "@/lib/supabase/server"
import { mapDocumentCourseIds, toRagCourseId } from "@/lib/server/course-id-map"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Proxy to the RAG service's document endpoints.
 *
 * The portal addresses courses by Supabase uuid; the RAG service addresses them
 * by its own `course-<code>` ids. Without translation every upload was rejected
 * with "You do not have access to this course", because the service could not
 * find a course whose id was a uuid it had never stored.
 */
export async function GET(req: Request) {
  if (!API_URL) {
    return NextResponse.json({ error: "API service not configured" }, { status: 503 })
  }

  const headers = await serviceHeaders()
  if (!headers) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const supabase = await createClient()
  const requested = new URL(req.url).searchParams.get("course_id")
  const ragCourseId = requested ? await toRagCourseId(supabase as any, requested) : null

  const query = ragCourseId ? `?course_id=${encodeURIComponent(ragCourseId)}` : ""
  const response = await fetch(`${API_URL}/v1/documents${query}`, {
    headers,
    cache: "no-store",
  })

  const data = await response.json().catch(() => [])
  if (!response.ok || !Array.isArray(data)) {
    return NextResponse.json(data, { status: response.status })
  }

  // Hand the portal back its own identifiers, or its course-scoped filters and
  // joins silently match nothing.
  const mapped = await mapDocumentCourseIds(supabase as any, data)
  return NextResponse.json(mapped, { status: response.status })
}

export async function POST(req: Request) {
  if (!API_URL) {
    return NextResponse.json({ error: "API service not configured" }, { status: 503 })
  }

  const headers = await serviceHeaders(req)
  if (!headers) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  // Course materials are uploaded by teachers only.
  if (!(await canManageMaterials())) {
    return NextResponse.json(
      { error: "Only teachers can upload materials" },
      { status: 403 },
    )
  }

  const form = await req.formData()
  if (!form.get("file")) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }

  const supabase = await createClient()
  const requested = form.get("course_id")
  if (typeof requested === "string" && requested) {
    const ragCourseId = await toRagCourseId(supabase as any, requested)
    if (!ragCourseId) {
      return NextResponse.json(
        { error: "That course could not be resolved for the document service" },
        { status: 400 },
      )
    }
    form.set("course_id", ragCourseId)
  }

  // Let fetch set the multipart boundary itself; do not pass Content-Type.
  const response = await fetch(`${API_URL}/v1/documents`, {
    method: "POST",
    headers,
    body: form,
  })

  const data = await response.json().catch(() => ({}))

  if (data && typeof data === "object" && "course_id" in data) {
    const [mapped] = await mapDocumentCourseIds(supabase as any, [data as any])
    return NextResponse.json(mapped, { status: response.status })
  }

  return NextResponse.json(data, { status: response.status })
}
