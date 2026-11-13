import { z } from "zod"

import { getCourseMaterialSourceText } from "@/lib/ai/course-rag"
import { completeStructured } from "@/lib/ai/text-generation"
import { assertCourseAccess, clientForPrincipal, resolvePrincipal } from "@/lib/server/principal"

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

    return Response.json({ flashcards: result.flashcards })
  } catch (error: any) {
    console.error("[flashcards] failed:", error?.message || error)
    return Response.json(
      { error: error?.message || "Could not generate flashcards" },
      { status: 502 },
    )
  }
}
