import { createUIMessageStream, createUIMessageStreamResponse, type UIMessageStreamWriter } from "ai"

import { getUserFacingChatError } from "@/lib/ai/chat-errors"
import {
  buildContext,
  citedTitles,
  groundedSystemPrompt,
  isRefusal,
  refusalPrompt,
  repairCitations,
  REFUSAL_TEXT,
  type Source,
} from "@/lib/ai/grounding"
import { streamChat, useOllama, type ChatMessage } from "@/lib/ai/ollama"
import { retrieveCourseRagContext } from "@/lib/ai/course-rag"

/**
 * Grounded chat against the local model, in-process.
 *
 * This module used to proxy to the FastAPI service. That service kept its own
 * Postgres, so the course ids the web app sent did not exist in the database the
 * service checked against, and every course-scoped question was rejected with
 * 403. Retrieval now runs here, against the same Supabase database the portal
 * pages read, and only generation is delegated to Ollama.
 *
 * The output is the AI SDK UI message stream, so the existing chat components
 * render it unchanged.
 */

type LocalChatOptions = {
  messages: unknown[]
  model: string
  courseId?: string | null
  pdfRagEnabled?: boolean
  /** Per-course assistant settings, already resolved by the caller. */
  toneInstruction?: string | null
  supabase?: any
  /** Overrides for the grounded context budget. */
  topK?: number
  /**
   * Called once the answer is complete, with the citation-repaired text.
   *
   * Streaming and repair pull in opposite directions: markers can only be
   * checked against the sources once the whole answer exists, but buffering
   * would hide a slow local model for 10+ seconds. So the user sees deltas as
   * they are generated, and this callback receives the corrected text for
   * persistence and analytics. Displayed text may therefore show an
   * unrepaired marker in the rare case repair rewrote one.
   */
  onComplete?: (result: {
    answer: string
    repaired: string
    revisions: Array<{ sentence: string; from: number; to: number }>
    refused: boolean
    sources: Source[]
  }) => void | Promise<void>
}

type WireMessage = { role: "user" | "assistant" | "system"; content: string }

/**
 * Local models are the default. `AI_PROVIDER=gemini` opts into the cloud path;
 * `auto` (the unset default) uses the local model only when no Gemini key
 * exists, so adding a key later restores cloud behaviour without a code change.
 */
export function shouldUseLocalChatService(): boolean {
  return useOllama()
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
 * Retrieval is what makes the pipeline refuse: with no matching course chunks it
 * answers "the course materials do not cover this". The general-purpose Default
 * Assistant therefore opts out, while course-grounded models and any request
 * carrying a course or document keep it on.
 */
function shouldRetrieve(options: LocalChatOptions): boolean {
  if (options.pdfRagEnabled) return true
  if (options.courseId) return true
  return options.model !== "default"
}

/** Answer length cap; small models otherwise ramble past the source material. */
const MAX_HISTORY_MESSAGES = 8

export async function createLocalChatResponse(options: LocalChatOptions) {
  const messages = normalizeMessages(options.messages)
  if (messages.length === 0) {
    return Response.json({ error: "A message is required" }, { status: 400 })
  }

  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user")
  const question = lastUserMessage?.content?.trim() || ""

  const toneInstruction = options.toneInstruction?.trim() || ""

  // ── Retrieval ────────────────────────────────────────────────
  // Scoped to one course. The caller has already verified the user may read
  // that course; retrieval does not widen the scope on its own.
  let sources: Source[] = []
  let contextText = ""
  let retrievalError: string | null = null

  if (shouldRetrieve(options) && question) {
    try {
      if (options.pdfRagEnabled) {
        // Document-scoped mode is handled by the cloud path only; local mode
        // still answers from course material so the chat is not a dead end.
        contextText = ""
      }
      if (options.courseId && options.supabase) {
        const retrieved = await retrieveCourseRagContext({
          supabase: options.supabase,
          courseId: options.courseId,
          query: question,
          topK: options.topK ?? 6,
        })
        sources = retrieved.sources
        contextText = retrieved.context
      }
    } catch (error: any) {
      // Retrieval failure must not become a hallucinated answer. Record it and
      // fall through to the refusal path with an explanatory message.
      retrievalError = error?.message || "Retrieval failed"
      console.error("[chat] retrieval failed:", retrievalError)
    }
  }

  // ── Prompt ───────────────────────────────────────────────────
  // History excludes the trailing question, which goes in as the final turn.
  const history = messages
    .filter((message) => message.role !== "system")
    .slice(-MAX_HISTORY_MESSAGES - 1, -1)

  let systemPrompt: string
  if (contextText && sources.length > 0) {
    systemPrompt = groundedSystemPrompt(contextText, toneInstruction)
  } else if (shouldRetrieve(options)) {
    // Course-grounded mode with nothing retrieved: refuse, do not guess.
    systemPrompt = refusalPrompt(toneInstruction)
  } else {
    systemPrompt = [
      options.model === "default"
        ? "You are a helpful and concise AI assistant. Be direct and friendly."
        : "You are an AI teaching assistant for MFU (Mae Fah Luang University).",
      toneInstruction,
    ]
      .filter(Boolean)
      .join("\n")
  }

  const chatMessages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...history.map((message) => ({ role: message.role, content: message.content })),
    { role: "user", content: question },
  ]

  const textId = "local-answer"
  let answer = ""

  const stream = createUIMessageStream({
    execute: async ({ writer }: { writer: UIMessageStreamWriter }) => {
      writer.write({ type: "start" })
      writer.write({ type: "text-start", id: textId })

      try {
        if (retrievalError) {
          // Be explicit that the assistant could not read the material, rather
          // than implying the material does not cover the question.
          const notice = `I could not search the course materials right now. Please retry, or ask your lecturer. (${retrievalError})`
          answer = notice
          writer.write({ type: "text-delta", id: textId, delta: notice })
        } else if (sources.length === 0 && shouldRetrieve(options)) {
          // No sources: emit the fixed refusal without spending a model call.
          answer = REFUSAL_TEXT
          writer.write({ type: "text-delta", id: textId, delta: REFUSAL_TEXT })
        } else {
          for await (const delta of streamChat(chatMessages)) {
            answer += delta
            writer.write({ type: "text-delta", id: textId, delta })
          }
        }
      } catch (error: any) {
        writer.write({ type: "error", errorText: getUserFacingChatError(error) })
      } finally {
        writer.write({ type: "text-end", id: textId })
        writer.write({ type: "finish" })

        if (options.onComplete && answer) {
          const repaired = repairCitations(answer, sources)
          try {
            await options.onComplete({
              answer,
              repaired: repaired.text,
              revisions: repaired.revisions,
              refused: isRefusal(answer) || sources.length === 0,
              sources,
            })
          } catch (callbackError: any) {
            // Persistence must never break the response the user already saw.
            console.error("[chat] onComplete failed:", callbackError?.message || callbackError)
          }
        }
      }
    },
    onError: (error: unknown) => getUserFacingChatError(error),
  } as any)

  return createUIMessageStreamResponse({
    stream,
    headers: {
      // Let the caller persist the exchange without re-running the model.
      "X-AI-Sources": encodeURIComponent(
        JSON.stringify(sources.map((source) => ({ n: source.n, title: source.materialTitle }))),
      ),
    },
  })
}

/**
 * Same grounding applied to a completed answer, for callers that need the final
 * text rather than a stream (analytics, feedback, evaluation).
 */
export function finalizeAnswer(rawAnswer: string, sources: Source[]) {
  const repaired = repairCitations(rawAnswer, sources)
  return {
    text: repaired.text,
    revisions: repaired.revisions,
    refused: isRefusal(repaired.text) || sources.length === 0,
    citedTitles: citedTitles(repaired.text, sources),
  }
}

export { buildContext }
