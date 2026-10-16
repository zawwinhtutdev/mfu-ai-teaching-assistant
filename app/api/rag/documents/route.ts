import { NextResponse } from "next/server"

import { API_URL, serviceHeaders } from "@/lib/api-service"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  if (!API_URL) {
    return NextResponse.json({ error: "API service not configured" }, { status: 503 })
  }

  const headers = await serviceHeaders()
  if (!headers) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const response = await fetch(`${API_URL}/v1/documents`, { headers, cache: "no-store" })
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
