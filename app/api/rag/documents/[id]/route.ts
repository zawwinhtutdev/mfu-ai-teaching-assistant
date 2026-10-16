import { NextResponse } from "next/server"

import { API_URL, serviceHeaders } from "@/lib/api-service"

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
  return NextResponse.json(data, { status: response.status })
}
