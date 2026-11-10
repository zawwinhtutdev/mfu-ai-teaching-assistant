import { createClient } from "@/lib/supabase/server"
import { isHttpsRequest } from "@/lib/server/request-security"
import { DEMO_EMAIL_COOKIE, DEMO_ROLE_COOKIE, getDemoAccountByRole, isDemoRole } from "@/lib/demo-auth"
import {
  DEMO_CONVERSATIONS_COOKIE,
  DEMO_CONVERSATIONS_COOKIE_MAX_AGE_SECONDS,
  DEMO_CONVERSATION_MAX_MESSAGES,
  buildDemoConversationTitle,
  readDemoConversationsCookie,
  writeDemoConversationsCookie,
} from "@/lib/demo-conversations"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const { conversationId } = await params
  console.log("🔍 API: Getting conversation:", conversationId)

  const cookieStore = await cookies()
  const demoRole = cookieStore.get(DEMO_ROLE_COOKIE)?.value
  const demoEmail = cookieStore.get(DEMO_EMAIL_COOKIE)?.value

  if (isDemoRole(demoRole)) {
    const demoAccount = getDemoAccountByRole(demoRole)
    if (!demoAccount || demoEmail?.toLowerCase() !== demoAccount.email.toLowerCase()) {
      return NextResponse.json({ error: "Unauthorized demo session" }, { status: 401 })
    }

    const conversations = readDemoConversationsCookie(cookieStore.get(DEMO_CONVERSATIONS_COOKIE)?.value, demoAccount.email)
    const conversation = conversations.find((item) => item.id === conversationId)

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
    }

    return NextResponse.json({
      conversation: {
        id: conversation.id,
        title: conversation.title,
        created_at: conversation.created_at,
        updated_at: conversation.updated_at,
      },
      messages: conversation.messages,
    })
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  console.log("👤 API: User:", user?.id)

  if (!user) {
    console.log("❌ API: No user found")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!conversationId) {
    console.log("❌ API: Missing conversation ID")
    return NextResponse.json({ error: "Conversation ID is required" }, { status: 400 })
  }

  // Verify user owns this conversation
  const { data: conversation } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .eq("user_id", user.id)
    .single()

  console.log("💬 API: Conversation found:", conversation?.id)

  if (!conversation) {
    console.log("❌ API: Conversation not found")
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
  }

  // Fetch messages
  const { data: messages, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })

  console.log("📨 API: Messages found:", messages?.length)
  console.log("📨 API: Messages data:", messages)

  if (error) {
    console.error("💥 API: Error fetching messages:", error)
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 })
  }

  console.log("✅ API: Returning conversation and messages")
  return NextResponse.json({ conversation, messages })
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const { conversationId } = await params

  const cookieStore = await cookies()
  const demoRole = cookieStore.get(DEMO_ROLE_COOKIE)?.value
  const demoEmail = cookieStore.get(DEMO_EMAIL_COOKIE)?.value

  if (!isDemoRole(demoRole)) {
    return NextResponse.json({ error: "Method not allowed" }, { status: 405 })
  }

  const demoAccount = getDemoAccountByRole(demoRole)
  if (!demoAccount || demoEmail?.toLowerCase() !== demoAccount.email.toLowerCase()) {
    return NextResponse.json({ error: "Unauthorized demo session" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const title = buildDemoConversationTitle(body?.title)
  const inputMessages = Array.isArray(body?.messages) ? body.messages : []
  const now = new Date().toISOString()

  const normalizedMessages = inputMessages
    .map((message: any, index: number) => {
      const role = message?.role === "assistant" ? "assistant" : message?.role === "user" ? "user" : null
      const content = typeof message?.content === "string" ? message.content.trim().slice(0, 1200) : ""
      if (!role || !content) return null
      return {
        id:
          typeof message?.id === "string" && message.id
            ? message.id
            : `demo-msg-${Date.now()}-${index}`,
        role,
        content,
        created_at:
          typeof message?.created_at === "string" && message.created_at
            ? message.created_at
            : now,
      }
    })
    .filter((message: any): message is { id: string; role: "user" | "assistant"; content: string; created_at: string } => !!message)
    .slice(-DEMO_CONVERSATION_MAX_MESSAGES)

  const current = readDemoConversationsCookie(cookieStore.get(DEMO_CONVERSATIONS_COOKIE)?.value, demoAccount.email)
  const existing = current.find((conversation) => conversation.id === conversationId)

  if (!existing) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
  }

  const updated = {
    ...existing,
    title: title || existing.title,
    updated_at: now,
    messages: normalizedMessages,
  }

  const nextConversations = [updated, ...current.filter((conversation) => conversation.id !== conversationId)]
  const response = NextResponse.json({ ok: true })
  response.cookies.set(DEMO_CONVERSATIONS_COOKIE, writeDemoConversationsCookie(demoAccount.email, nextConversations), {
    httpOnly: true,
    secure: await isHttpsRequest(),
    sameSite: "lax",
    path: "/",
    maxAge: DEMO_CONVERSATIONS_COOKIE_MAX_AGE_SECONDS,
  })

  return response
}
