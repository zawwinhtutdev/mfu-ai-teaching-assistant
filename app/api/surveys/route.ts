import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Standard SUS questions
const SUS_QUESTIONS = [
  "I think that I would like to use this system frequently.",
  "I found the system unnecessarily complex.",
  "I thought the system was easy to use.",
  "I think that I would need the support of a technical person to use this system.",
  "I found the various functions in this system were well integrated.",
  "I thought there was too much inconsistency in this system.",
  "I would imagine that most people would learn to use this system very quickly.",
  "I found the system very cumbersome to use.",
  "I felt very confident using the system.",
  "I needed to learn a lot of things before I could get going with this system.",
]

/**
 * Calculate SUS score from answers array (1-5 scale for 10 questions)
 * Odd-numbered questions: score - 1
 * Even-numbered questions: 5 - score
 * Sum * 2.5 = SUS score (0-100)
 */
function calculateSUSScore(answers: number[]): number {
  if (answers.length !== 10) return 0

  let sum = 0
  for (let i = 0; i < 10; i++) {
    if (i % 2 === 0) {
      // Odd questions (0-indexed even): score - 1
      sum += answers[i] - 1
    } else {
      // Even questions (0-indexed odd): 5 - score
      sum += 5 - answers[i]
    }
  }

  return sum * 2.5
}

/**
 * GET /api/surveys
 * List surveys (teacher sees all their surveys, student sees active ones for enrolled courses)
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
    const surveyId = url.searchParams.get("surveyId")

    // If requesting results for a specific survey
    if (surveyId) {
      const { data: survey } = await supabase
        .from("surveys")
        .select("*")
        .eq("id", surveyId)
        .single()

      if (!survey) {
        return NextResponse.json({ error: "Survey not found" }, { status: 404 })
      }

      const { data: responses } = await supabase
        .from("survey_responses")
        .select("*")
        .eq("survey_id", surveyId)

      const totalResponses = responses?.length || 0
      const avgScore = totalResponses > 0
        ? (responses!.reduce((sum, r) => sum + (r.score || 0), 0) / totalResponses)
        : null

      return NextResponse.json({
        survey,
        responses: responses || [],
        stats: {
          totalResponses,
          averageScore: avgScore ? Math.round(avgScore * 10) / 10 : null,
          susQuestions: survey.survey_type === "sus" ? SUS_QUESTIONS : undefined,
        },
      })
    }

    // List surveys
    let query = supabase.from("surveys").select("*").order("created_at", { ascending: false })
    if (courseId) {
      query = query.eq("course_id", courseId)
    }

    const { data: surveys, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ surveys: surveys || [], susQuestions: SUS_QUESTIONS })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to load surveys" }, { status: 500 })
  }
}

/**
 * POST /api/surveys
 * Create a new survey (teacher) or submit a response (student)
 */
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()

    // If submitting a response
    if (body.surveyId && body.answers) {
      const { surveyId, answers } = body

      const { data: survey } = await supabase
        .from("surveys")
        .select("*")
        .eq("id", surveyId)
        .single()

      if (!survey) {
        return NextResponse.json({ error: "Survey not found" }, { status: 404 })
      }

      // Calculate score
      let score: number | null = null
      if (survey.survey_type === "sus") {
        const scores = Object.values(answers) as number[]
        score = calculateSUSScore(scores)
      } else {
        // Satisfaction: average of all answers (1-5)
        const values = Object.values(answers) as number[]
        score = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null
      }

      const { data: response, error } = await supabase
        .from("survey_responses")
        .upsert(
          {
            survey_id: surveyId,
            user_id: user.id,
            answers,
            score,
          },
          { onConflict: "survey_id,user_id" }
        )
        .select()
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ response, score })
    }

    // Creating a new survey (teacher only)
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (profile?.role !== "teacher" && profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { title, surveyType, courseId } = body

    if (!title || !surveyType || !courseId) {
      return NextResponse.json({ error: "title, surveyType, and courseId are required" }, { status: 400 })
    }

    const { data: survey, error } = await supabase
      .from("surveys")
      .insert({
        title: title.trim(),
        survey_type: surveyType,
        course_id: courseId,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ survey })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed" }, { status: 500 })
  }
}
