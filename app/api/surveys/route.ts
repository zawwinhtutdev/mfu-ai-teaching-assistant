import { NextResponse } from "next/server"

import { assertCourseAccess, clientForPrincipal, resolvePrincipal } from "@/lib/server/principal"

/**
 * Evaluation surveys (spec §9 usability / satisfaction measurement).
 *
 * Previously authenticated with `supabase.auth.getUser()` only. Demo accounts
 * therefore got a 401, the student widget hid itself and the teacher panel
 * always reported "No surveys yet" — making the §9 targets unmeasurable in the
 * environment the project is demonstrated in.
 */

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
 * SUS score from ten 1-5 answers.
 * Odd items score (value - 1), even items score (5 - value); the sum is doubled
 * and multiplied by 2.5 to normalise to 0-100.
 */
function calculateSUSScore(answers: number[]): number {
  if (answers.length !== 10) return 0
  let sum = 0
  for (let i = 0; i < 10; i += 1) {
    sum += i % 2 === 0 ? answers[i] - 1 : 5 - answers[i]
  }
  return sum * 2.5
}

export async function GET(req: Request) {
  try {
    const principal = await resolvePrincipal()
    if (!principal) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = new URL(req.url)
    const courseId = url.searchParams.get("courseId")
    const surveyId = url.searchParams.get("surveyId")
    const supabase = await clientForPrincipal(principal)

    // Results for one survey.
    if (surveyId) {
      const { data: survey } = await supabase
        .from("surveys")
        .select("*")
        .eq("id", surveyId)
        .maybeSingle()

      if (!survey) {
        return NextResponse.json({ error: "Survey not found" }, { status: 404 })
      }

      const course = await assertCourseAccess(principal, survey.course_id)
      if (!course) {
        return NextResponse.json({ error: "You do not have access to this survey" }, { status: 403 })
      }

      const { data: responses } = await supabase
        .from("survey_responses")
        .select("id, score, answers, created_at")
        .eq("survey_id", surveyId)

      const rows = responses ?? []
      const scored = rows.filter((row: any) => typeof row.score === "number")
      const averageScore =
        scored.length > 0
          ? scored.reduce((sum: number, row: any) => sum + row.score, 0) / scored.length
          : null

      return NextResponse.json({
        survey,
        responses: rows,
        stats: {
          totalResponses: rows.length,
          averageScore: averageScore === null ? null : Math.round(averageScore * 10) / 10,
          susQuestions: survey.survey_type === "sus" ? SUS_QUESTIONS : undefined,
        },
      })
    }

    // Surveys for a course.
    if (!courseId) {
      return NextResponse.json({ error: "courseId or surveyId is required" }, { status: 400 })
    }

    const course = await assertCourseAccess(principal, courseId)
    if (!course) {
      return NextResponse.json({ error: "You do not have access to this course" }, { status: 403 })
    }

    const { data: surveys, error } = await supabase
      .from("surveys")
      .select("*")
      .eq("course_id", course.id)
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ surveys: surveys || [], susQuestions: SUS_QUESTIONS })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to load surveys" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const principal = await resolvePrincipal()
    if (!principal) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let body: any
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const supabase = await clientForPrincipal(principal)

    // Submitting a response.
    if (body?.surveyId && body?.answers) {
      const { data: survey } = await supabase
        .from("surveys")
        .select("*")
        .eq("id", body.surveyId)
        .maybeSingle()

      if (!survey) {
        return NextResponse.json({ error: "Survey not found" }, { status: 404 })
      }

      const course = await assertCourseAccess(principal, survey.course_id)
      if (!course) {
        return NextResponse.json({ error: "You do not have access to this survey" }, { status: 403 })
      }

      const values = Object.values(body.answers) as number[]
      if (values.length === 0 || values.some((value) => typeof value !== "number")) {
        return NextResponse.json({ error: "answers must map to numeric ratings" }, { status: 400 })
      }

      const score =
        survey.survey_type === "sus"
          ? calculateSUSScore(values)
          : values.reduce((a, b) => a + b, 0) / values.length

      // A demo principal has no profile row, so the response cannot be stored
      // against a user id. Report the computed score instead of throwing a
      // foreign-key error at the student.
      if (!principal.isPersistable) {
        return NextResponse.json({ score, stored: false })
      }

      const { data: response, error } = await supabase
        .from("survey_responses")
        .upsert(
          {
            survey_id: body.surveyId,
            user_id: principal.userId,
            answers: body.answers,
            score,
          },
          { onConflict: "survey_id,user_id" },
        )
        .select()
        .maybeSingle()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ response, score, stored: true })
    }

    // Creating a survey (teacher or admin).
    if (principal.role !== "teacher" && principal.role !== "admin") {
      return NextResponse.json({ error: "Only a teacher may create a survey" }, { status: 403 })
    }

    const title = typeof body?.title === "string" ? body.title.trim() : ""
    const surveyType = body?.surveyType === "sus" ? "sus" : "satisfaction"
    const courseId = typeof body?.courseId === "string" ? body.courseId : ""

    if (!title || !courseId) {
      return NextResponse.json({ error: "title and courseId are required" }, { status: 400 })
    }

    const course = await assertCourseAccess(principal, courseId)
    if (!course) {
      return NextResponse.json({ error: "You do not have access to this course" }, { status: 403 })
    }

    const { data: survey, error } = await supabase
      .from("surveys")
      .insert({
        title,
        survey_type: surveyType,
        course_id: course.id,
        ...(principal.isPersistable ? { created_by: principal.userId } : {}),
      })
      .select()
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ survey })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to process survey" }, { status: 500 })
  }
}
