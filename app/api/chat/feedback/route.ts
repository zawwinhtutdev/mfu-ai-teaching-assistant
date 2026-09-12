import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * POST /api/chat/feedback
 * Save a thumbs up/down rating on an AI response message
 */
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { messageId, rating, comment } = await req.json()

    if (!messageId || !rating) {
      return NextResponse.json(
        { error: "messageId and rating are required" },
        { status: 400 }
      )
    }

    if (!["positive", "negative"].includes(rating)) {
      return NextResponse.json(
        { error: "rating must be 'positive' or 'negative'" },
        { status: 400 }
      )
    }

    // Verify the user owns the conversation containing this message
    const { data: message } = await supabase
      .from("messages")
      .select("id, conversation_id, role")
      .eq("id", messageId)
      .single()

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 })
    }

    if (message.role !== "assistant") {
      return NextResponse.json(
        { error: "Can only rate assistant messages" },
        { status: 400 }
      )
    }

    // Verify conversation belongs to user
    const { data: conversation } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", message.conversation_id)
      .eq("user_id", user.id)
      .single()

    if (!conversation) {
      return NextResponse.json(
        { error: "Not authorized to rate this message" },
        { status: 403 }
      )
    }

    // Upsert feedback (update if already rated)
    const { data: feedback, error } = await supabase
      .from("chat_feedback")
      .upsert(
        {
          message_id: messageId,
          user_id: user.id,
          rating,
          comment: comment || null,
        },
        { onConflict: "message_id,user_id" }
      )
      .select()
      .single()

    if (error) {
      console.error("[Feedback] Error saving feedback:", error)
      return NextResponse.json(
        { error: "Failed to save feedback" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, feedback })
  } catch (error) {
    console.error("[Feedback] Unexpected error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * GET /api/chat/feedback?messageId=xxx
 * Get feedback for a specific message (or all feedback for analytics)
 */
export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = new URL(req.url)
    const messageId = url.searchParams.get("messageId")

    if (messageId) {
      // Get feedback for a specific message
      const { data } = await supabase
        .from("chat_feedback")
        .select("rating, comment")
        .eq("message_id", messageId)
        .eq("user_id", user.id)
        .maybeSingle()

      return NextResponse.json({ feedback: data })
    }

    // Get accuracy stats (for teacher analytics)
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (profile?.role !== "teacher" && profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: stats } = await supabase
      .from("chat_feedback")
      .select("rating")

    const total = stats?.length || 0
    const positive = stats?.filter((s) => s.rating === "positive").length || 0
    const accuracy = total > 0 ? Math.round((positive / total) * 100) : null

    return NextResponse.json({
      total,
      positive,
      negative: total - positive,
      accuracy,
      target: 85,
    })
  } catch (error) {
    console.error("[Feedback] Unexpected error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
