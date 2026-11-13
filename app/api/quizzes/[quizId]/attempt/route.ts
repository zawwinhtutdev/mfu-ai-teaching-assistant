import { NextResponse } from "next/server"

import { assertCourseAccess, clientForPrincipal, resolvePrincipal } from "@/lib/server/principal"

/**
 * Score one quiz attempt.
 *
 * The quiz list omits `correct_answer` for students so the answers are not
 * readable in the network response before submitting. This endpoint is the only
 * place the key is applied, and it returns just the key plus a score — never the
 * stored quiz row, which would leak every answer at once.
 *
 * Attempts are not stored: `quizzes` has no attempt table, and adding one is a
 * schema change that belongs with a real assessment feature (timing, multiple
 * tries, gradebook integration). Until then this scores and reports.
 */

type RouteContext = { params: Promise<{ quizId: string }> }

export async function POST(req: Request, { params }: RouteContext) {
  const { quizId } = await params
  const principal = await resolvePrincipal()
  if (!principal) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const raw = body?.answers
  if (!raw || typeof raw !== "object") {
    return NextResponse.json({ error: "answers is required" }, { status: 400 })
  }

  const supabase = await clientForPrincipal(principal)

  const { data: quiz } = await supabase
    .from("quizzes")
    .select("id, course_id, questions, is_published, student_id")
    .eq("id", quizId)
    .maybeSingle()

  if (!quiz) return NextResponse.json({ error: "Quiz not found" }, { status: 404 })

  if (!(await assertCourseAccess(principal, quiz.course_id))) {
    return NextResponse.json({ error: "You do not have access to this quiz" }, { status: 403 })
  }

  // A draft is a teacher's work in progress, and another student's practice
  // quiz is not yours to answer.
  const isOwnPractice = quiz.student_id === principal.userId
  if (!isOwnPractice && !quiz.is_published) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 })
  }

  const questions: Array<{ correct_answer?: number }> = Array.isArray(quiz.questions)
    ? quiz.questions
    : []

  if (questions.length === 0) {
    return NextResponse.json({ error: "This quiz has no questions" }, { status: 400 })
  }

  const answerKey = questions.map((question) => Number(question?.correct_answer ?? 0))

  let correct = 0
  answerKey.forEach((expected, index) => {
    if (Number(raw[index]) === expected) correct++
  })

  const score = Math.round((correct / questions.length) * 100)

  return NextResponse.json({
    answerKey,
    correct,
    total: questions.length,
    score,
    passed: score >= 70,
  })
}
