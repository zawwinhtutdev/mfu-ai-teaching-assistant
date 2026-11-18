import { NextResponse } from "next/server"

import { API_URL, serviceHeaders } from "@/lib/api-service"
import { createClient } from "@/lib/supabase/server"
import { mapDocumentCourseId } from "@/lib/server/course-id-map"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  if (!API_URL) {
    return NextResponse.json({ error: "API service not configured" }, { status: 503 })
  }

  const headers = await serviceHeaders()
  if (!headers) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { id } = await context.params
  const response = await fetch(`${API_URL}/v1/documents/${id}`, {
    headers,
    cache: "no-store",
  })
  const data = await response.json().catch(() => ({}))

  // Translate the service's course id back to the portal's uuid, or the
  // document will not match the course it is listed under.
  if (response.ok && data && typeof data === "object" && "course_id" in data) {
    const supabase = await createClient()
    const mapped = await mapDocumentCourseId(supabase as any, data as any)
    return NextResponse.json(mapped, { status: response.status })
  }

  return NextResponse.json(data, { status: response.status })
}
