import { getAllDocsMarkdown } from "@/lib/docs"

export const dynamic = "force-static"

export async function GET() {
  const content = await getAllDocsMarkdown()

  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  })
}
