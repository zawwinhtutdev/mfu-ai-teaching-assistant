import { createClient } from "@/lib/supabase/server"
import { isHttpsRequest } from "@/lib/server/request-security"
import { DEMO_EMAIL_COOKIE, DEMO_ROLE_COOKIE, getDemoAccountByRole, isDemoRole } from "@/lib/demo-auth"
import {
  DEMO_CONVERSATIONS_COOKIE,
  DEMO_CONVERSATIONS_COOKIE_MAX_AGE_SECONDS,
  buildDemoConversationTitle,
  readDemoConversationsCookie,
  writeDemoConversationsCookie,
} from "@/lib/demo-conversations"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  try {
    const courseId = new URL(req.url).searchParams.get("courseId")?.trim() || ""
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const scopedCourseId = uuidPattern.test(courseId) ? courseId : ""

    const cookieStore = await cookies()
    const demoRole = cookieStore.get(DEMO_ROLE_COOKIE)?.value
    const demoEmail = cookieStore.get(DEMO_EMAIL_COOKIE)?.value

    if (isDemoRole(demoRole) && !scopedCourseId) {
      const demoAccount = getDemoAccountByRole(demoRole)

      if (demoAccount && demoEmail?.toLowerCase() === demoAccount.email.toLowerCase()) {
        const conversations = readDemoConversationsCookie(
          cookieStore.get(DEMO_CONVERSATIONS_COOKIE)?.value,
          demoAccount.email,
        )
        return NextResponse.json({
          conversations: conversations.map((conversation) => ({
            id: conversation.id,
            title: conversation.title,
            created_at: conversation.created_at,
            updated_at: conversation.updated_at,
          })),
        })
      }

      return NextResponse.json({ conversations: [] })
    }

    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Fetch conversations for the current user (optionally scoped to a course)
    let conversationsQuery = supabase
      .from("conversations")
      .select("*")
      .eq("user_id", user.id)
    if (scopedCourseId) conversationsQuery = conversationsQuery.eq("course_id", scopedCourseId)
    const { data: conversations, error } = await conversationsQuery.order("updated_at", { ascending: false })

    if (error) {
      console.error("[v0] Error fetching conversations:", error)
      return NextResponse.json({ error: "Failed to fetch conversations" }, { status: 500 })
    }

    return NextResponse.json({ conversations: conversations || [] })
  } catch (error) {
    console.error("[v0] Conversations API error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const title = buildDemoConversationTitle(body?.title)
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const requestedCourseId = typeof body?.courseId === "string" && uuidPattern.test(body.courseId.trim())
      ? body.courseId.trim()
      : ""

    const cookieStore = await cookies()
    const demoRole = cookieStore.get(DEMO_ROLE_COOKIE)?.value
    const demoEmail = cookieStore.get(DEMO_EMAIL_COOKIE)?.value

    if (isDemoRole(demoRole) && !requestedCourseId) {
      const demoAccount = getDemoAccountByRole(demoRole)
      if (!demoAccount || demoEmail?.toLowerCase() !== demoAccount.email.toLowerCase()) {
        return NextResponse.json({ error: "Unauthorized demo session" }, { status: 401 })
      }

      const current = readDemoConversationsCookie(cookieStore.get(DEMO_CONVERSATIONS_COOKIE)?.value, demoAccount.email)
      const now = new Date().toISOString()
      const conversation = {
        id: `demo-conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title,
        created_at: now,
        updated_at: now,
        messages: [],
      }
      const response = NextResponse.json(
        {
          conversation: {
            id: conversation.id,
            title: conversation.title,
            created_at: conversation.created_at,
            updated_at: conversation.updated_at,
          },
        },
        { status: 201 },
      )
      response.cookies.set(DEMO_CONVERSATIONS_COOKIE, writeDemoConversationsCookie(demoAccount.email, [conversation, ...current]), {
        httpOnly: true,
        secure: await isHttpsRequest(),
        sameSite: "lax",
        path: "/",
        maxAge: DEMO_CONVERSATIONS_COOKIE_MAX_AGE_SECONDS,
      })
      return response
    }

    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (requestedCourseId) {
      const { data: course } = await supabase
        .from("courses")
        .select("id, teacher_id")
        .eq("id", requestedCourseId)
        .maybeSingle()
      if (!course) {
        return NextResponse.json({ error: "Course not found" }, { status: 404 })
      }
      if (course.teacher_id !== user.id) {
        const { data: enrollment } = await supabase
          .from("course_enrollments")
          .select("id")
          .eq("course_id", requestedCourseId)
          .eq("student_id", user.id)
          .maybeSingle()
        if (!enrollment) {
          return NextResponse.json({ error: "You do not have access to this course" }, { status: 403 })
        }
      }
    }

    const { data: conversation, error } = await supabase
      .from("conversations")
      .insert({
        user_id: user.id,
        title,
        course_id: requestedCourseId || null,
      })
      .select("*")
      .single()

    if (error || !conversation) {
      console.error("[v0] Error creating conversation:", error)
      return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 })
    }

    return NextResponse.json({ conversation }, { status: 201 })
  } catch (error) {
    console.error("[v0] Conversations POST API error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
