import { NextResponse } from "next/server"
import { completeText } from "@/lib/ai/text-generation"
import { logAuditEvent } from "@/lib/server/audit-log"
import { clientForPrincipal, resolvePrincipal } from "@/lib/server/principal"

/**
 * Study planner.
 *
 * Two problems this had: it authenticated with `supabase.auth.getUser()` only,
 * so demo students got a 401 and the planner never loaded; and AI generation
 * called Gemini directly, so it threw on the local-model setup where there is
 * no key. Generation now goes through `completeText`, which picks the local
 * model unless a Gemini key is configured.
 */

/**
 * GET /api/study-planner
 * Get study plan items for the current user
 */
export async function GET(req: Request) {
  try {
    const principal = await resolvePrincipal()
    if (!principal) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Demo principals have no profile row, so they have no stored plan.
    if (!principal.isPersistable) {
      return NextResponse.json({ plans: [] })
    }

    const supabase = await clientForPrincipal(principal)
    const url = new URL(req.url)
    const courseId = url.searchParams.get("courseId")

    let query = supabase
      .from("study_plans")
      .select("*")
      .eq("user_id", principal.userId)
      .order("due_date", { ascending: true, nullsFirst: false })

    if (courseId) {
      query = query.eq("course_id", courseId)
    }

    const { data: plans, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ plans: plans || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed" }, { status: 500 })
  }
}

/**
 * POST /api/study-planner
 * Create a study plan item, or ask AI to generate one
 */
export async function POST(req: Request) {
  try {
    const principal = await resolvePrincipal()
    if (!principal) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()

    // Demo principals cannot own study_plans rows (no profile to reference).
    if (!principal.isPersistable) {
      return NextResponse.json(
        { error: "Demo accounts cannot save a study plan. Sign in with a real university account." },
        { status: 403 },
      )
    }

    const supabase = await clientForPrincipal(principal)

    // If AI generation requested
    if (body.generateAI && body.courseId) {
      // Get course materials for context
      const { data: course } = await supabase
        .from("courses")
        .select("title, code")
        .eq("id", body.courseId)
        .maybeSingle()

      const { data: materials } = await supabase
        .from("course_materials")
        .select("title, material_type")
        .eq("course_id", body.courseId)
        .limit(10)

      const materialList = (materials || [])
        .map((m: any) => `- ${m.title} (${m.material_type})`)
        .join("\n")

      // Provider-agnostic: local model by default, Gemini only if configured.
      const text = await completeText(
        `You are a study planner AI. Generate a personalized 7-day study plan for the course "${course?.title || "Unknown"}" (${course?.code || ""}).

Course materials:
${materialList || "No materials uploaded yet"}

Generate exactly 5-7 study tasks as a JSON array. Each item should have:
- title: concise task name
- description: brief actionable description (1-2 sentences)
- due_date: YYYY-MM-DD format, spread across next 7 days starting from today
- priority: "low", "medium", or "high"

Only output the JSON array, no markdown or explanation.`,
      )

      try {
        // Extract JSON array from response
        const jsonMatch = text.match(/\[[\s\S]*\]/)
        if (!jsonMatch) {
          return NextResponse.json({ error: "The model did not return a plan" }, { status: 502 })
        }

        const tasks = JSON.parse(jsonMatch[0])
        const insertData = tasks.map((task: any) => ({
          user_id: principal.userId,
          course_id: body.courseId,
          title: String(task.title || "Study Task"),
          description: String(task.description || ""),
          due_date: task.due_date || null,
          priority: ["low", "medium", "high"].includes(task.priority) ? task.priority : "medium",
          ai_generated: true,
        }))

        const { data: plans, error } = await supabase
          .from("study_plans")
          .insert(insertData)
          .select("*")

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ plans: plans || [], aiGenerated: true })
      } catch (parseError) {
        return NextResponse.json({ error: "Failed to parse the generated plan" }, { status: 502 })
      }
    }

    // Manual creation
    const { title, description, dueDate, priority, courseId } = body

    if (!title?.trim()) {
      return NextResponse.json({ error: "title is required" }, { status: 400 })
    }

    const { data: plan, error } = await supabase
      .from("study_plans")
      .insert({
        user_id: principal.userId,
        course_id: courseId || null,
        title: title.trim(),
        description: description?.trim() || null,
        due_date: dueDate || null,
        priority: priority || "medium",
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ plan })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed" }, { status: 500 })
  }
}

/**
 * PATCH /api/study-planner
 * Toggle completion or update a plan item
 */
export async function PATCH(req: Request) {
  try {
    const principal = await resolvePrincipal()
    if (!principal) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!principal.isPersistable) {
      return NextResponse.json({ error: "Demo accounts cannot change a study plan." }, { status: 403 })
    }

    const { planId, completed, title, description } = await req.json()

    if (!planId) {
      return NextResponse.json({ error: "planId is required" }, { status: 400 })
    }

    const updateData: Record<string, any> = {}
    if (typeof completed === "boolean") updateData.completed = completed
    if (title) updateData.title = title.trim()
    if (description !== undefined) updateData.description = description?.trim() || null

    const supabase = await clientForPrincipal(principal)
    const { data: plan, error } = await supabase
      .from("study_plans")
      .update(updateData)
      .eq("id", planId)
      .eq("user_id", principal.userId)
      .select()
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ plan })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed" }, { status: 500 })
  }
}

/**
 * DELETE /api/study-planner
 * Delete a plan item
 */
export async function DELETE(req: Request) {
  try {
    const principal = await resolvePrincipal()
    if (!principal) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!principal.isPersistable) {
      return NextResponse.json({ error: "Demo accounts cannot change a study plan." }, { status: 403 })
    }

    const { planId } = await req.json()

    if (!planId) {
      return NextResponse.json({ error: "planId is required" }, { status: 400 })
    }

    const supabase = await clientForPrincipal(principal)
    const { error } = await supabase
      .from("study_plans")
      .delete()
      .eq("id", planId)
      .eq("user_id", principal.userId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed" }, { status: 500 })
  }
}
