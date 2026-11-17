import { z } from "zod"

import { getCourseMaterialSourceText } from "@/lib/ai/course-rag"
import { completeStructured } from "@/lib/ai/text-generation"
import { assertCourseAccess, clientForPrincipal, resolvePrincipal } from "@/lib/server/principal"

const quizSchema = z.object({
  title: z.string(),
  questions: z.array(
    z.object({
      question: z.string(),
      options: z.array(z.string()),
      correct_answer: z.number(),
    }),
  ),
})

export async function POST(req: Request) {
  const principal = await resolvePrincipal()
  if (!principal) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { materialId } = await req.json()
  if (!materialId) {
    return Response.json({ error: "materialId is required" }, { status: 400 })
  }

  const supabase = await clientForPrincipal(principal)

  const { data: material } = await supabase
    .from("course_materials")
    .select("id, course_id, title, content")
    .eq("id", materialId)
    .maybeSingle()

  if (!material) {
    return Response.json({ error: "Material not found" }, { status: 404 })
  }

  if (!(await assertCourseAccess(principal, material.course_id))) {
    return Response.json({ error: "You do not have access to this material" }, { status: 403 })
  }

  try {
    const materialSource = await getCourseMaterialSourceText({
      supabase: supabase as any,
      materialId,
    })

    const result = await completeStructured(
      `Create a short multiple-choice quiz about the following material.

Material Title: ${materialSource.title}
Content:
${materialSource.text}

Write 5 questions. Each question must have exactly 4 options and one correct
answer. "correct_answer" is the zero-based index of the correct option (0-3).
Questions must be answerable from the material alone.

Return JSON exactly in this shape:
{"title":"...","questions":[{"question":"...","options":["a","b","c","d"],"correct_answer":0}]}`,
      quizSchema,
      { system: "You write quiz questions from course material. Never invent facts." },
    )

    // A model that returns the wrong number of options would break the UI's
    // rendering silently, so reject it rather than shipping a malformed quiz.
    const malformed = result.questions.find(
      (question) =>
        question.options.length !== 4 ||
        question.correct_answer < 0 ||
        question.correct_answer > 3,
    )
    if (malformed) {
      throw new Error("The model returned a question without exactly four options or a valid answer index")
    }

    return Response.json(result)
  } catch (error: any) {
    console.error("[quiz] failed:", error?.message || error)
    return Response.json({ error: error?.message || "Could not generate a quiz" }, { status: 502 })
  }
}
