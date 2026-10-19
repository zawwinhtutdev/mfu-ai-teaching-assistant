import { NextResponse } from "next/server"

import { API_URL, canManageMaterials, serviceHeaders } from "@/lib/api-service"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(req: Request) {
  if (!API_URL) {
    return NextResponse.json({ error: "API service not configured" }, { status: 503 })
  }

  const headers = await serviceHeaders()
  if (!headers) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const courseId = new URL(req.url).searchParams.get("course_id")
  const query = courseId ? `?course_id=${encodeURIComponent(courseId)}` : ""
  const response = await fetch(`${API_URL}/v1/documents${query}`, {
    headers,
    cache: "no-store",
  })
  const data = await response.json().catch(() => [])
  return NextResponse.json(data, { status: response.status })
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

  // Let fetch set the multipart boundary itself; do not pass Content-Type.
  const response = await fetch(`${API_URL}/v1/documents`, {
    method: "POST",
    headers,
    body: form,
  })

  const data = await response.json().catch(() => ({}))
  return NextResponse.json(data, { status: response.status })
}
