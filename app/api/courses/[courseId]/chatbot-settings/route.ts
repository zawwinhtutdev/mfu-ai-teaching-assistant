/**
 * Chatbot settings for one course.
 *
 * The Agent Builder page used to talk to Supabase straight from the browser,
 * passing whatever course id the portal handed it. Demo courses use seed ids
 * like `course-ai-edu`, so the write failed with a raw Postgres error:
 *
 *   invalid input syntax for type uuid: "course-ai-edu"
 *
 * Routing through this route fixes that for two reasons: `assertCourseAccess`
 * resolves a course code or a UUID to the real row, and authorization happens
 * server-side instead of relying on the client to send the right id.
 */

import { NextResponse } from "next/server"

import { assertCourseAccess, clientForPrincipal, resolvePrincipal } from "@/lib/server/principal"

const TONES = ["professional", "friendly", "casual", "formal"] as const

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const principal = await resolvePrincipal()
  if (!principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { courseId } = await params
  const course = await assertCourseAccess(principal, courseId)
  if (!course) {
    return NextResponse.json({ error: "You do not have access to this course" }, { status: 403 })
  }

  const supabase = await clientForPrincipal(principal)
  const { data, error } = await supabase
    .from("chatbot_settings")
    .select("tone, ai_model, system_prompt, grading_policy, course_rules")
    .eq("course_id", course.id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Settings are optional; an absent row means "platform defaults", not an error.
  return NextResponse.json({ settings: data ?? null, courseId: course.id })
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const principal = await resolvePrincipal()
  if (!principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Only the teacher who owns the course (or an admin) may change its agent.
  if (principal.role !== "teacher" && principal.role !== "admin") {
    return NextResponse.json({ error: "Only the course teacher may change these settings" }, { status: 403 })
  }

  const { courseId } = await params
  const course = await assertCourseAccess(principal, courseId)
  if (!course) {
    return NextResponse.json({ error: "You do not have access to this course" }, { status: 403 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const tone = typeof body?.tone === "string" ? body.tone.trim() : "professional"
  if (!TONES.includes(tone as (typeof TONES)[number])) {
    return NextResponse.json(
      { error: `tone must be one of: ${TONES.join(", ")}` },
      { status: 400 },
    )
  }

  const trimOrNull = (value: unknown) =>
    typeof value === "string" && value.trim() ? value.trim() : null

  const supabase = await clientForPrincipal(principal)

  const { data, error } = await supabase
    .from("chatbot_settings")
    .upsert(
      {
        course_id: course.id,
        tone,
        ai_model: typeof body?.aiModel === "string" && body.aiModel.trim() ? body.aiModel.trim() : null,
        system_prompt: trimOrNull(body?.systemPrompt),
        grading_policy: trimOrNull(body?.gradingPolicy),
        course_rules: trimOrNull(body?.courseRules),
      },
      { onConflict: "course_id" },
    )
    .select("tone, ai_model, system_prompt, grading_policy, course_rules")
    .maybeSingle()

  if (error) {
    // Demo principals have no auth session, so RLS rejects the write. Say so in
    // terms a demo user can act on rather than surfacing a policy violation.
    if (error.code === "42501" || /row-level security/i.test(error.message)) {
      return NextResponse.json(
        {
          error: principal.isDemo
            ? "Demo accounts cannot save settings. Sign in with a real university account to persist changes."
            : "You are not allowed to change this course's settings.",
        },
        { status: 403 },
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ settings: data })
}
