import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { GoogleGenAI } from "@google/genai"

const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || "text-embedding-004"
const EMBEDDING_DIMENSIONS = Number(process.env.GEMINI_EMBEDDING_DIMENSIONS || 768)

function getGeminiClient() {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY
  if (!apiKey) throw new Error("Missing Gemini API key")
  return new GoogleGenAI({ apiKey })
}

async function embedText(text: string): Promise<number[]> {
  const ai = getGeminiClient()
  const response = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text,
    config: { taskType: "RETRIEVAL_DOCUMENT", outputDimensionality: EMBEDDING_DIMENSIONS } as any,
  })
  const values = (response.embeddings || [])[0]?.values
  return Array.isArray(values) ? values : []
}

/**
 * GET /api/courses/[courseId]/faqs
 * List all FAQs for a course
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ courseId: string }> },
) {
  try {
    const { courseId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: faqs, error } = await supabase
      .from("faqs")
      .select("id, question, answer, created_at, updated_at")
      .eq("course_id", courseId)
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ faqs: faqs || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to load FAQs" }, { status: 500 })
  }
}

/**
 * POST /api/courses/[courseId]/faqs
 * Create a new FAQ (auto-embeds the question for vector search)
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ courseId: string }> },
) {
  try {
    const { courseId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify teacher owns course
    const { data: course } = await supabase
      .from("courses")
      .select("id, teacher_id")
      .eq("id", courseId)
      .eq("teacher_id", user.id)
      .single()

    if (!course) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { question, answer } = await req.json()

    if (!question?.trim() || !answer?.trim()) {
      return NextResponse.json({ error: "Question and answer are required" }, { status: 400 })
    }

    // Generate embedding for the question
    let embedding: number[] = []
    try {
      embedding = await embedText(question.trim())
    } catch (embErr: any) {
      console.error("[FAQ] Embedding failed:", embErr?.message)
      // Continue without embedding — FAQ will still work, just not via vector search
    }

    const insertData: any = {
      course_id: courseId,
      question: question.trim(),
      answer: answer.trim(),
      created_by: user.id,
    }

    if (embedding.length > 0) {
      insertData.embedding = `[${embedding.join(",")}]`
    }

    const { data: faq, error } = await supabase
      .from("faqs")
      .insert(insertData)
      .select("id, question, answer, created_at")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ faq })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to create FAQ" }, { status: 500 })
  }
}

/**
 * DELETE /api/courses/[courseId]/faqs
 * Delete a FAQ by id (passed in body)
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ courseId: string }> },
) {
  try {
    const { courseId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { faqId } = await req.json()
    if (!faqId) {
      return NextResponse.json({ error: "faqId is required" }, { status: 400 })
    }

    // Verify teacher owns course
    const { data: course } = await supabase
      .from("courses")
      .select("id")
      .eq("id", courseId)
      .eq("teacher_id", user.id)
      .single()

    if (!course) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { error } = await supabase
      .from("faqs")
      .delete()
      .eq("id", faqId)
      .eq("course_id", courseId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to delete FAQ" }, { status: 500 })
  }
}
