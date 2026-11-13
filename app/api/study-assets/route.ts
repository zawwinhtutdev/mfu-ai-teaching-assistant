/**
 * Stored study assets for one course.
 *
 * The generation endpoints write summaries, flashcards and practice quizzes,
 * but the course page is a server component that cannot read them through the
 * browser client. This returns the caller's own set so a reload shows what was
 * generated instead of an empty tab.
 */

import { NextResponse } from "next/server"

import { assertCourseAccess, clientForPrincipal, resolvePrincipal } from "@/lib/server/principal"

export async function GET(req: Request) {
  const principal = await resolvePrincipal()
  if (!principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const courseId = new URL(req.url).searchParams.get("courseId")
  if (!courseId) {
    return NextResponse.json({ error: "courseId is required" }, { status: 400 })
  }

  // Demo principals carry seed ids ("course-csb321") that are not UUIDs, so
  // nothing they generate can be stored. Answer empty rather than 403: the
  // client would render an error banner for what is a normal demo state.
  if (principal.isDemo || !principal.isPersistable) {
    return NextResponse.json({ summaries: {}, flashcardCounts: {}, quizzes: [] })
  }

  const course = await assertCourseAccess(principal, courseId)
  if (!course) {
    return NextResponse.json({ error: "You do not have access to this course" }, { status: 403 })
  }

  const supabase = await clientForPrincipal(principal)

  const [summaryResult, flashcardResult, quizResult] = await Promise.all([
    supabase
      .from("material_summaries")
      .select("material_id, summary_text")
      .eq("student_id", principal.userId)
      .eq("course_id", course.id),
    supabase
      .from("flashcards")
      .select("material_id")
      .eq("student_id", principal.userId)
      .eq("course_id", course.id),
    supabase
      .from("quizzes")
      .select("id, title, questions, created_at")
      .eq("course_id", course.id)
      .eq("student_id", principal.userId)
      .order("created_at", { ascending: false }),
  ])

  const summaries: Record<string, string> = {}
  for (const row of summaryResult.data ?? []) {
    if (row.material_id) summaries[row.material_id] = row.summary_text
  }

  // Counts rather than the cards themselves: the Flashcards tab loads its own
  // deck, and the material card only needs to say "a deck exists".
  const flashcardCounts: Record<string, number> = {}
  for (const row of flashcardResult.data ?? []) {
    const key = row.material_id ?? "unattached"
    flashcardCounts[key] = (flashcardCounts[key] ?? 0) + 1
  }

  return NextResponse.json({
    summaries,
    flashcardCounts,
    quizzes: quizResult.data ?? [],
  })
}
