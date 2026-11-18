import { z } from "zod"

import { getCourseMaterialSourceText } from "@/lib/ai/course-rag"
import { completeStructured } from "@/lib/ai/text-generation"
import { assertCourseAccess, clientForPrincipal, resolvePrincipal } from "@/lib/server/principal"
import { RATE_LIMITS, checkRateLimit, rateLimitResponse, userRateLimitKey } from "@/lib/server/rate-limit"

const flashcardsSchema = z.object({
  flashcards: z.array(
    z.object({
      question: z.string(),
      answer: z.string(),
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
  const limit = checkRateLimit(userRateLimitKey("generate-flashcards", principal.userId), RATE_LIMITS.generation)
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

  // Authorize on the row's own course, not on whatever the client sent.
  if (!(await assertCourseAccess(principal, material.course_id))) {
    return Response.json({ error: "You do not have access to this material" }, { status: 403 })
  }

  try {
    const materialSource = await getCourseMaterialSourceText({
      supabase: supabase as any,
      materialId,
    })

    const result = await completeStructured(
      `Generate 5-10 educational flashcards from the following material.

Material Title: ${materialSource.title}
Content:
${materialSource.text}

Each flashcard needs a clear question and a concise answer that helps a student
memorise and understand a key concept. Cover important definitions, processes and
examples.

Return JSON exactly in this shape:
{"flashcards":[{"question":"...","answer":"..."}]}`,
      flashcardsSchema,
      { system: "You create study flashcards from course material. Be accurate and concise." },
    )

    // Persist as the caller's own study set. Regenerating replaces the previous
    // set for this material instead of appending, so the Flashcards tab shows
    // one coherent deck rather than every run ever made.
    const saved = await persistFlashcards({
      supabase,
      principal,
      materialId,
      courseId: material.course_id,
      cards: result.flashcards,
    })

    return Response.json({ flashcards: result.flashcards, saved })
  } catch (error: any) {
    console.error("[flashcards] failed:", error?.message || error)
    return Response.json(
      { error: error?.message || "Could not generate flashcards" },
      { status: 502 },
    )
  }
}

async function persistFlashcards(params: {
  supabase: any
  principal: { userId: string; role: string; isPersistable: boolean }
  materialId: string
  courseId: string
  cards: Array<{ question: string; answer: string }>
}): Promise<boolean> {
  const { supabase, principal, materialId, courseId, cards } = params

  // Demo ids are not UUIDs, so writing them would violate the foreign key. The
  // caller still gets the cards back for this session.
  if (!principal.isPersistable) return false
  if (cards.length === 0) return false

  // Clear the old deck first: a partial replace would leave stale cards mixed
  // with new ones, which is worse than either state on its own.
  const { error: clearError } = await supabase
    .from("flashcards")
    .delete()
    .eq("student_id", principal.userId)
    .eq("material_id", materialId)

  if (clearError) {
    console.error("[flashcards] could not clear previous deck:", clearError.message)
    return false
  }

  const rows = cards.map((card) => ({
    student_id: principal.userId,
    course_id: courseId,
    material_id: materialId,
    question: card.question,
    answer: card.answer,
  }))

  const { error } = await supabase.from("flashcards").insert(rows)
  if (error) {
    console.error("[flashcards] could not store deck:", error.message)
    return false
  }

  return true
}
