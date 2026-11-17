import { createClient } from "@/lib/supabase/server"
import { getCourseMaterialSourceText } from "@/lib/ai/course-rag"
import { completeText } from "@/lib/ai/text-generation"
import { assertCourseAccess, clientForPrincipal, resolvePrincipal } from "@/lib/server/principal"

export async function POST(req: Request) {
  const principal = await resolvePrincipal()
  if (!principal) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { materialId, courseId } = await req.json()

  if (!materialId) {
    return Response.json({ error: "materialId is required" }, { status: 400 })
  }

  // Materials belong to a course, and reading one must be checked against the
  // course the caller may access — not just against their own user id.
  const authorized = courseId ? await assertCourseAccess(principal, courseId) : null
  const supabase = await clientForPrincipal(principal)

  const { data: material } = await supabase
    .from("course_materials")
    .select("id, course_id, title, content")
    .eq("id", materialId)
    .maybeSingle()

  if (!material) {
    return Response.json({ error: "Material not found" }, { status: 404 })
  }

  // The course id on the row is authoritative; verify the caller can read it
  // even when they did not supply one.
  const canRead = authorized?.id === material.course_id
    ? true
    : Boolean(await assertCourseAccess(principal, material.course_id))

  if (!canRead) {
    return Response.json({ error: "You do not have access to this material" }, { status: 403 })
  }

  try {
    const materialSource = await getCourseMaterialSourceText({
      supabase: supabase as any,
      materialId,
    })

    const summary = await completeText(
      `Summarize the following educational material in a clear, concise way. Focus on key concepts, main ideas, and important details that students should remember.

Material Title: ${materialSource.title}
Content:
${materialSource.text}

Provide a well-structured summary with:
1. Main topic overview
2. Key concepts (bullet points)
3. Important takeaways`,
    )

    return Response.json({ summary })
  } catch (error: any) {
    console.error("[summarize] failed:", error?.message || error)
    return Response.json(
      { error: error?.message || "Could not generate a summary" },
      { status: 502 },
    )
  }
}
