import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { GoogleGenAI } from "@google/genai"

function getGeminiClient() {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY
  if (!apiKey) throw new Error("Missing Gemini API key")
  return new GoogleGenAI({ apiKey })
}

/**
 * GET /api/study-planner
 * Get study plan items for the current user
 */
export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = new URL(req.url)
    const courseId = url.searchParams.get("courseId")

    let query = supabase
      .from("study_plans")
      .select("*")
      .eq("user_id", user.id)
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
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()

    // If AI generation requested
    if (body.generateAI && body.courseId) {
      // Get course materials for context
      const { data: course } = await supabase
        .from("courses")
        .select("title, code")
        .eq("id", body.courseId)
        .single()

      const { data: materials } = await supabase
        .from("course_materials")
        .select("title, material_type")
        .eq("course_id", body.courseId)
        .limit(10)

      const materialList = (materials || [])
        .map((m: any) => `- ${m.title} (${m.material_type})`)
        .join("\n")

      const ai = getGeminiClient()
      const result = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: `You are a study planner AI. Generate a personalized 7-day study plan for the course "${course?.title || "Unknown"}" (${course?.code || ""}).

Course materials:
${materialList || "No materials uploaded yet"}

Generate exactly 5-7 study tasks as a JSON array. Each item should have:
- title: concise task name
- description: brief actionable description (1-2 sentences)
- due_date: YYYY-MM-DD format, spread across next 7 days starting from today
- priority: "low", "medium", or "high"

Only output the JSON array, no markdown or explanation.`,
      })

      try {
        const text = typeof (result as any)?.text === "string" ? (result as any).text : ""
        // Extract JSON array from response
        const jsonMatch = text.match(/\[[\s\S]*\]/)
        if (!jsonMatch) {
          return NextResponse.json({ error: "AI failed to generate plan" }, { status: 500 })
        }

        const tasks = JSON.parse(jsonMatch[0])
        const insertData = tasks.map((task: any) => ({
          user_id: user.id,
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
        return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 })
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
        user_id: user.id,
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
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { planId, completed, title, description } = await req.json()

    if (!planId) {
      return NextResponse.json({ error: "planId is required" }, { status: 400 })
    }

    const updateData: Record<string, any> = {}
    if (typeof completed === "boolean") updateData.completed = completed
    if (title) updateData.title = title.trim()
    if (description !== undefined) updateData.description = description?.trim() || null

    const { data: plan, error } = await supabase
      .from("study_plans")
      .update(updateData)
      .eq("id", planId)
      .eq("user_id", user.id)
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
 * DELETE /api/study-planner
 * Delete a plan item
 */
export async function DELETE(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { planId } = await req.json()

    if (!planId) {
      return NextResponse.json({ error: "planId is required" }, { status: 400 })
    }

    const { error } = await supabase
      .from("study_plans")
      .delete()
      .eq("id", planId)
      .eq("user_id", user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed" }, { status: 500 })
  }
}
