export const DEMO_CONVERSATIONS_COOKIE = "mfu_demo_conversations"
export const DEMO_CONVERSATIONS_MAX_ITEMS = 6
export const DEMO_CONVERSATION_MAX_MESSAGES = 24
export const DEMO_CONVERSATION_MESSAGE_MAX_CHARS = 1200
export const DEMO_CONVERSATIONS_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7
const DEMO_CONVERSATIONS_COOKIE_TARGET_BYTES = 3500

export type DemoConversationMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  created_at: string
}

export type DemoConversationRecord = {
  id: string
  title: string
  created_at: string
  updated_at: string
  messages: DemoConversationMessage[]
}

type DemoConversationsPayload = {
  email: string
  conversations: DemoConversationRecord[]
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function trimText(value: string) {
  return value.trim().slice(0, DEMO_CONVERSATION_MESSAGE_MAX_CHARS)
}

function normalizeRole(value: unknown): DemoConversationMessage["role"] | null {
  return value === "assistant" || value === "user" ? value : null
}

function normalizeMessage(value: any): DemoConversationMessage | null {
  if (!value || typeof value !== "object") return null
  if (typeof value.id !== "string") return null

  const role = normalizeRole(value.role)
  if (!role) return null

  const content = typeof value.content === "string" ? trimText(value.content) : ""
  if (!content) return null

  const createdAt =
    typeof value.created_at === "string" && value.created_at ? value.created_at : new Date().toISOString()

  return {
    id: value.id,
    role,
    content,
    created_at: createdAt,
  }
}

function normalizeConversation(value: any): DemoConversationRecord | null {
  if (!value || typeof value !== "object") return null
  if (typeof value.id !== "string") return null

  const title = typeof value.title === "string" && value.title.trim() ? value.title.trim().slice(0, 100) : "New Conversation"
  const createdAt =
    typeof value.created_at === "string" && value.created_at ? value.created_at : new Date().toISOString()
  const updatedAt =
    typeof value.updated_at === "string" && value.updated_at ? value.updated_at : createdAt
  const normalizedMessages = Array.isArray(value.messages)
    ? value.messages.map(normalizeMessage).filter((item: any): item is DemoConversationMessage => !!item)
    : []

  return {
    id: value.id,
    title,
    created_at: createdAt,
    updated_at: updatedAt,
    messages: normalizedMessages.slice(-DEMO_CONVERSATION_MAX_MESSAGES),
  }
}

function sortByUpdatedAtDesc(conversations: DemoConversationRecord[]) {
  return [...conversations].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
}

function applyLimits(conversations: DemoConversationRecord[]) {
  let next = sortByUpdatedAtDesc(conversations)
    .slice(0, DEMO_CONVERSATIONS_MAX_ITEMS)
    .map((conversation) => ({
      ...conversation,
      messages: conversation.messages.slice(-DEMO_CONVERSATION_MAX_MESSAGES),
    }))

  // Keep trimming oldest message/conversation until we fit comfortably under cookie limits.
  while (JSON.stringify({ email: "demo", conversations: next }).length > DEMO_CONVERSATIONS_COOKIE_TARGET_BYTES) {
    const oldestConversationIndex = next.length - 1
    if (oldestConversationIndex < 0) break

    const oldestConversation = next[oldestConversationIndex]
    if (oldestConversation.messages.length > 1) {
      oldestConversation.messages = oldestConversation.messages.slice(1)
      oldestConversation.updated_at =
        oldestConversation.messages[oldestConversation.messages.length - 1]?.created_at || oldestConversation.updated_at
      continue
    }

    next = next.slice(0, -1)
  }

  return next
}

export function readDemoConversationsCookie(rawCookie: string | undefined, expectedEmail: string): DemoConversationRecord[] {
  if (!rawCookie) return []

  try {
    const payload = JSON.parse(rawCookie) as DemoConversationsPayload
    if (!payload || typeof payload !== "object") return []
    if (typeof payload.email !== "string") return []
    if (normalizeEmail(payload.email) !== normalizeEmail(expectedEmail)) return []
    if (!Array.isArray(payload.conversations)) return []

    const normalized = payload.conversations
      .map(normalizeConversation)
      .filter((item): item is DemoConversationRecord => !!item)

    return applyLimits(normalized)
  } catch {
    return []
  }
}

export function writeDemoConversationsCookie(email: string, conversations: DemoConversationRecord[]) {
  const payload: DemoConversationsPayload = {
    email: normalizeEmail(email),
    conversations: applyLimits(conversations),
  }
  return JSON.stringify(payload)
}

export function buildDemoConversationTitle(rawTitle: unknown) {
  if (typeof rawTitle === "string" && rawTitle.trim()) {
    return rawTitle.trim().slice(0, 100)
  }
  return "New Conversation"
}
