import { generateText } from "ai"
import { google } from "@ai-sdk/google"
import { createClient } from "@/lib/supabase/server"
import { getCourseMaterialSourceText } from "@/lib/ai/course-rag"

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { materialId, courseId, studentId } = await req.json()

  // Get material content
  const { data: material } = await supabase.from("course_materials").select("*").eq("id", materialId).single()

  if (!material) {
    return Response.json({ error: "Material not found" }, { status: 404 })
  }

  const materialSource = await getCourseMaterialSourceText({
    supabase: supabase as any,
    materialId,
  })

  // Generate summary
  const { text } = await generateText({
    model: google("gemini-3.8-flash"),
    prompt: `Summarize the following educational material in a clear, concise way. Focus on key concepts, main ideas, and important details that students should remember.

Material Title: ${materialSource.title}
Content:
${materialSource.text}

Provide a well-structured summary with:
1. Main topic overview
2. Key concepts (bullet points)
3. Important takeaways`,
    maxOutputTokens: 1000,
  })

  return Response.json({ summary: text })
}
