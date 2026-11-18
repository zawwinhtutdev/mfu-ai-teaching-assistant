import { NextResponse } from "next/server"

import { embedTexts as embedWithOllama, isOllamaEnabled } from "@/lib/ai/ollama"
import { assertCourseAccess, clientForPrincipal, resolvePrincipal } from "@/lib/server/principal"

/**
 * FAQs for one course.
 *
 * Two things this route had wrong:
 *
 * 1. It authenticated with `supabase.auth.getUser()` only, so every demo account
 *    got a 401 and the teacher's FAQ tab silently rendered an empty list.
 * 2. It embedded questions with Gemini unconditionally, so on the local-model
 *    setup every insert failed to produce a vector — and `match_faqs` filters on
 *    `embedding IS NOT NULL`, making those FAQs invisible to retrieval.
 *
 * Both now go through the shared helpers: `resolvePrincipal` for identity and
 * the same embedder the rest of the app uses (Ollama locally, Gemini if enabled).
 */

async function embedQuestion(question: string): Promise<number[] | null> {
  try {
    const [vector] = await embedWithOllama([question])
    if (Array.isArray(vector) && vector.length > 0) return vector
    return null
  } catch (error: any) {
    console.error("[FAQ] embedding failed:", error?.message || error)
    return null
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ courseId: string }> },
) {
  try {
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
    const { data: faqs, error } = await supabase
      .from("faqs")
      .select("id, question, answer, created_at, updated_at")
      .eq("course_id", course.id)
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ faqs: faqs || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to load FAQs" }, { status: 500 })
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ courseId: string }> },
) {
  try {
    const principal = await resolvePrincipal()
    if (!principal) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (principal.role !== "teacher" && principal.role !== "admin") {
      return NextResponse.json({ error: "Only the course teacher may add FAQs" }, { status: 403 })
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

    const question = typeof body?.question === "string" ? body.question.trim() : ""
    const answer = typeof body?.answer === "string" ? body.answer.trim() : ""
    if (!question || !answer) {
      return NextResponse.json({ error: "Question and answer are required" }, { status: 400 })
    }

    // An unembedded FAQ is still readable but invisible to vector search, so a
    // failure here is reported rather than silently degrading the assistant.
    const embedding = await embedQuestion(question)

    const supabase = await clientForPrincipal(principal)
    const insertData: Record<string, unknown> = {
      course_id: course.id,
      question,
      answer,
      ...(principal.isPersistable ? { created_by: principal.userId } : {}),
      ...(embedding ? { embedding: `[${embedding.join(",")}]` } : {}),
    }

    const { data: faq, error } = await supabase
      .from("faqs")
      .insert(insertData)
      .select("id, question, answer, created_at")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ faq, embedded: Boolean(embedding) })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to create FAQ" }, { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ courseId: string }> },
) {
  try {
    const principal = await resolvePrincipal()
    if (!principal) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (principal.role !== "teacher" && principal.role !== "admin") {
      return NextResponse.json({ error: "Only the course teacher may delete FAQs" }, { status: 403 })
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

    const faqId = typeof body?.faqId === "string" ? body.faqId : ""
    if (!faqId) {
      return NextResponse.json({ error: "faqId is required" }, { status: 400 })
    }

    const supabase = await clientForPrincipal(principal)
    const { error } = await supabase
      .from("faqs")
      .delete()
      .eq("id", faqId)
      .eq("course_id", course.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to delete FAQ" }, { status: 500 })
  }
}
