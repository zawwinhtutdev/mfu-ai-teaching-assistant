import { generateText, Output } from "ai"
import { google } from "@ai-sdk/google"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getCourseMaterialSourceText } from "@/lib/ai/course-rag"

const flashcardsSchema = z.object({
  flashcards: z.array(
    z.object({
      question: z.string().describe("A clear question about the material"),
      answer: z.string().describe("A concise answer to the question"),
    }),
  ),
})

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

  // Generate flashcards
  const { output } = await generateText({
    model: google("gemini-3.8-flash"),
    output: Output.object({ schema: flashcardsSchema }),
    prompt: `Generate 5-10 educational flashcards from the following material. Each flashcard should have a clear question and a concise answer that helps students learn and remember key concepts.

Material Title: ${materialSource.title}
Content:
${materialSource.text}

Create flashcards that:
- Cover important concepts and definitions
- Are clear and easy to understand
- Help with memorization and comprehension
- Vary in difficulty`,
  })

  // Save flashcards to database
  const flashcardsToInsert = output.flashcards.map((fc) => ({
    student_id: studentId,
    course_id: courseId,
    material_id: materialId,
    question: fc.question,
    answer: fc.answer,
  }))

  const { data: savedFlashcards, error } = await supabase.from("flashcards").insert(flashcardsToInsert).select()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ flashcards: savedFlashcards })
}
