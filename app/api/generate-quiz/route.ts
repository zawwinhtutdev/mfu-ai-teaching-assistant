import { generateText, Output } from "ai"
import { google } from "@ai-sdk/google"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getCourseMaterialSourceText } from "@/lib/ai/course-rag"

const quizSchema = z.object({
  title: z.string(),
  questions: z.array(
    z.object({
      question: z.string(),
      options: z.array(z.string()).length(4),
      correct_answer: z.number().min(0).max(3),
    }),
  ),
})

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { materialId, courseId } = await req.json()

  // Get material content
  const { data: material } = await supabase.from("course_materials").select("*").eq("id", materialId).single()

  if (!material) {
    return Response.json({ error: "Material not found" }, { status: 404 })
  }

  const materialSource = await getCourseMaterialSourceText({
    supabase: supabase as any,
    materialId,
  })

  // Generate quiz
  const { output } = await generateText({
    model: google("gemini-3.8-flash"),
    output: Output.object({ schema: quizSchema }),
    prompt: `Generate a quiz with 5 multiple-choice questions based on the following educational material.

Material Title: ${materialSource.title}
Content:
${materialSource.text}

For each question:
- Create a clear, specific question
- Provide 4 answer options (A, B, C, D)
- Mark the correct answer (0-3 index)
- Ensure questions test understanding, not just memorization
- Vary difficulty levels

Return a quiz title and the questions array.`,
  })

  // Save quiz to database
  const { data: savedQuiz, error } = await supabase
    .from("quizzes")
    .insert({
      course_id: courseId,
      title: output.title,
      questions: output.questions,
    })
    .select()
    .single()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ quiz: savedQuiz })
}
