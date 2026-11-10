import { createUIMessageStream, createUIMessageStreamResponse, type UIMessageStreamWriter } from "ai"

import { getUserFacingChatError } from "@/lib/ai/chat-errors"
import { API_URL, serviceHeaders } from "@/lib/api-service"

/**
 * Bridge between the AI SDK chat UI and the FastAPI/Ollama service.
 *
 * `/api/chat` speaks the AI SDK *UI message stream* protocol, while the Python
 * service emits its own SSE events (`sources` / `start` / `delta` / `done`).
 * This module translates one into the other so the chat shell keeps working
 * against a local model with no Gemini key.
 */

type LocalChatOptions = {
  messages: unknown[]
  model: string
  courseId?: string | null
  pdfRagEnabled?: boolean
}

type WireMessage = { role: "user" | "assistant" | "system"; content: string }

/**
 * Local models are the default. `AI_PROVIDER=gemini` opts into the cloud path;
 * `auto` (the unset default) uses the local service only when no Gemini key
 * exists, so adding a key later restores cloud behaviour without a code change.
 */
export function shouldUseLocalChatService(): boolean {
  const provider = (process.env.AI_PROVIDER ?? "").trim().toLowerCase()
  if (provider === "gemini") return false
  if (provider === "ollama" || provider === "stub") return true
  return !process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim()
}

function extractText(value: { content?: unknown; parts?: unknown }): string {
  if (Array.isArray(value?.parts)) {
    const fromParts = value.parts
      .filter((part: any) => part?.type === "text" && typeof part?.text === "string")
      .map((part: any) => part.text)
      .join("\n")
      .trim()
    if (fromParts) return fromParts
  }

  if (typeof value?.content === "string") return value.content.trim()

  if (Array.isArray(value?.content)) {
    return value.content
      .map((part: any) => (typeof part === "string" ? part : part?.type === "text" ? part?.text : ""))
      .filter((part: unknown): part is string => typeof part === "string")
      .join("\n")
      .trim()
  }

  return ""
}

function normalizeMessages(messages: unknown[]): WireMessage[] {
  return (Array.isArray(messages) ? messages : [])
    .map((message) => {
      const value = (message ?? {}) as { role?: unknown; content?: unknown; parts?: unknown }
      const role =
        value.role === "assistant" || value.role === "system" || value.role === "user"
          ? value.role
          : "user"
      const content = extractText(value)
      if (!content) return null
      return { role, content } as WireMessage
    })
    .filter((message): message is WireMessage => message !== null)
}

/**
 * Retrieval is what makes the pipeline refuse: with no matching course chunks
 * it answers "the course materials do not cover this". The general-purpose
 * Default Assistant therefore opts out, while course-grounded models and any
 * request carrying a course or document keep it on.
 */
function shouldRetrieve(options: LocalChatOptions): boolean {
  if (options.pdfRagEnabled) return true
  if (options.courseId) return true
  return options.model !== "default"
}

function firstDataLine(event: string): string | null {
  for (const line of event.split("\n")) {
    if (line.startsWith("data:")) return line.slice(5).trim()
  }
  return null
}

export async function createLocalChatResponse(options: LocalChatOptions) {
  if (!API_URL) {
    return Response.json(
      {
        error: "Local AI service is not configured",
        hint: "Set API_SERVICE_URL to the FastAPI service, or set GOOGLE_GENERATIVE_AI_API_KEY for cloud models.",
      },
      { status: 503 },
    )
  }

  const headers = await serviceHeaders()
  if (!headers) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }

  const messages = normalizeMessages(options.messages)
  if (messages.length === 0) {
    return Response.json({ error: "A message is required" }, { status: 400 })
  }

  let upstream: Response
  try {
    upstream = await fetch(`${API_URL}/v1/chat`, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        messages,
        use_retrieval: shouldRetrieve(options),
        ...(options.courseId ? { course_id: options.courseId } : {}),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(120_000),
    })
  } catch (error) {
    return Response.json(
      {
        error: "Local AI service is unreachable",
        hint: `Could not reach ${API_URL}. Start it with ./scripts/dev.sh start.`,
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 502 },
    )
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "")
    // Surface the service's own verdict (401/403/422) rather than a blanket 502.
    return Response.json(
      {
        error: "Local AI service refused the request",
        status: upstream.status,
        detail: detail.slice(0, 500),
      },
      { status: upstream.status },
    )
  }

  const textId = "local-answer"
  const body = upstream.body

  const stream = createUIMessageStream({
    execute: async ({ writer }: { writer: UIMessageStreamWriter }) => {
      writer.write({ type: "start" })
      writer.write({ type: "text-start", id: textId })

      const reader = body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      const handle = (raw: string) => {
        if (!raw || raw === "[DONE]") return
        let parsed: any
        try {
          parsed = JSON.parse(raw)
        } catch {
          return
        }

        if (parsed?.type === "delta" && typeof parsed.text === "string" && parsed.text) {
          writer.write({ type: "text-delta", id: textId, delta: parsed.text })
          return
        }

        if (parsed?.type === "error") {
          const message = typeof parsed.message === "string" ? parsed.message : ""
          writer.write({ type: "error", errorText: getUserFacingChatError(new Error(message)) })
        }
      }

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const events = buffer.split("\n\n")
          buffer = events.pop() ?? ""
          for (const event of events) {
            const raw = firstDataLine(event)
            if (raw !== null) handle(raw)
          }
        }

        const trailing = buffer.trim()
        if (trailing) {
          const raw = firstDataLine(trailing)
          if (raw !== null) handle(raw)
        }
      } catch (error) {
        writer.write({ type: "error", errorText: getUserFacingChatError(error) })
      } finally {
        writer.write({ type: "text-end", id: textId })
        writer.write({ type: "finish" })
        reader.releaseLock?.()
      }
    },
    onError: (error: unknown) => getUserFacingChatError(error),
  } as any)

  return createUIMessageStreamResponse({ stream })
}
