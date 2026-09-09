import { NextResponse } from "next/server"
import { getDocsSearchIndex } from "@/lib/docs"

export const dynamic = "force-static"

export async function GET() {
  const searchIndex = await getDocsSearchIndex()

  return NextResponse.json(searchIndex, {
    headers: {
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  })
}
