import { z } from "zod"

import { getCourseMaterialSourceText } from "@/lib/ai/course-rag"
import { completeStructured } from "@/lib/ai/text-generation"
import { assertCourseAccess, clientForPrincipal, resolvePrincipal } from "@/lib/server/principal"
import { RATE_LIMITS, checkRateLimit, rateLimitResponse, userRateLimitKey } from "@/lib/server/rate-limit"

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

  // Charged before the material lookup so a refused request never reaches the
  // provider. A request that later 404s still costs an attempt.
  const limit = checkRateLimit(userRateLimitKey("generate-quiz", principal.userId), RATE_LIMITS.generation)
  if (!limit.ok) {
    return rateLimitResponse(limit)
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

    // Persist. A teacher generating from their own material creates a
    // course-wide quiz they can review before releasing; a student gets a
    // personal practice quiz, which is what spec §2.1 "Study Guidance" means
    // by personalised practice questions.
    const saved = await persistQuiz({
      supabase,
      principal,
      materialId,
      courseId: material.course_id,
      quiz: result,
    })

    return Response.json({ ...result, id: saved?.id ?? null, saved: Boolean(saved) })
  } catch (error: any) {
    console.error("[quiz] failed:", error?.message || error)
    return Response.json({ error: error?.message || "Could not generate a quiz" }, { status: 502 })
  }
}

async function persistQuiz(params: {
  supabase: any
  principal: { userId: string; role: string; isPersistable: boolean }
  materialId: string
  courseId: string
  quiz: { title: string; questions: Array<{ question: string; options: string[]; correct_answer: number }> }
}): Promise<{ id: string } | null> {
  const { supabase, principal, materialId, courseId, quiz } = params

  // Demo ids are seed strings, not UUIDs, and would violate the foreign keys.
  if (!principal.isPersistable) return null

  const isTeacher = principal.role === "teacher" || principal.role === "admin"

  const { data, error } = await supabase
    .from("quizzes")
    .insert({
      course_id: courseId,
      material_id: materialId,
      title: quiz.title,
      questions: quiz.questions,
      created_by: principal.userId,
      // A teacher reviewing generated questions is the review step, so the quiz
      // is published immediately and can be pulled back with Unpublish. Saving
      // it as a draft left it invisible to the class with no way to release it,
      // because nothing in the UI could flip the flag.
      is_published: true,
      student_id: isTeacher ? null : principal.userId,
    })
    .select("id")
    .maybeSingle()

  if (error) {
    console.error("[quiz] could not store quiz:", error.message)
    return null
  }

  return data ?? null
}
