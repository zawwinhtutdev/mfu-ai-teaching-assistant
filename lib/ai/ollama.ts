/**
 * Ollama client for the Next.js server.
 *
 * Two capabilities, both over the local HTTP API:
 *
 * - `streamChat` — NDJSON from `POST /api/chat`, exposed as an async iterator
 *   of text deltas.
 * - `embedTexts` — vectors from `POST /api/embed`, normalised to unit length.
 *
 * Why this exists in the web app rather than the Python service: the app is the
 * only thing that owns a Supabase session and therefore the only place that can
 * read course-scoped rows without a second database. Calling Ollama directly
 * removes the cross-database hop that made every course id ambiguous.
 *
 * `nomic-embed-text` returns 768 dimensions, matching the `vector(768)` column
 * on `course_material_chunks`, so the same vectors work with the existing
 * `match_course_material_chunks` RPC.
 */

const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/+$/, "")
export const OLLAMA_CHAT_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:7b"
export const OLLAMA_EMBEDDING_MODEL = process.env.OLLAMA_EMBEDDING_MODEL || "nomic-embed-text"
export const EMBEDDING_DIMENSIONS = 768

export class OllamaError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = "OllamaError"
    this.status = status
  }
}

export type ChatMessage = {
  role: "system" | "user" | "assistant"
  content: string
}

function timeoutSignal(ms: number) {
  // AbortSignal.timeout is available on Node 22+, which package.json requires.
  return AbortSignal.timeout(ms)
}

/**
 * Stream a chat completion, yielding text deltas as they arrive.
 *
 * Ollama's wire format is newline-delimited JSON, so a chunk can split mid-line.
 * The buffer is drained on every chunk and the trailing partial line is kept for
 * the next read; otherwise long answers lose characters at chunk boundaries.
 */
export async function* streamChat(
  messages: ChatMessage[],
  options: { model?: string; timeoutMs?: number; signal?: AbortSignal } = {},
): AsyncGenerator<string> {
  const model = options.model || OLLAMA_CHAT_MODEL
  const signals = [timeoutSignal(options.timeoutMs ?? 180_000)]
  if (options.signal) signals.push(options.signal)

  let response: Response
  try {
    response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: true,
        messages: messages.filter((message) => message.content),
      }),
      signal: AbortSignal.any(signals),
    })
  } catch (error) {
    throw new OllamaError(
      `Could not reach Ollama at ${OLLAMA_BASE_URL}. Start it and run \`ollama pull ${model}\`.` +
        (error instanceof Error ? ` (${error.message})` : ""),
    )
  }

  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => "")
    throw new OllamaError(
      `Ollama returned ${response.status}: ${detail.slice(0, 300)}. Is \`ollama pull ${model}\` done?`,
      response.status,
    )
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      // The last element is either an empty string (line was complete) or a
      // partial JSON object still being written.
      buffer = lines.pop() ?? ""

      for (const line of lines) {
        const delta = parseStreamLine(line)
        if (delta) yield delta
      }
    }

    const trailing = parseStreamLine(buffer)
    if (trailing) yield trailing
  } finally {
    reader.releaseLock?.()
  }
}

function parseStreamLine(line: string): string | null {
  const trimmed = line.trim()
  if (!trimmed) return null

  let event: any
  try {
    event = JSON.parse(trimmed)
  } catch {
    return null
  }

  if (event?.error) {
    throw new OllamaError(String(event.error))
  }

  const content = event?.message?.content
  return typeof content === "string" && content ? content : null
}

function normalise(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0))
  if (norm === 0) return vector
  return vector.map((value) => value / norm)
}

/**
 * Embed one or more texts. Returns unit-length vectors in input order.
 *
 * A count mismatch is an error rather than a truncation: silently dropping a
 * vector would misalign chunks with embeddings and corrupt retrieval.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []

  let response: Response
  try {
    response = await fetch(`${OLLAMA_BASE_URL}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: OLLAMA_EMBEDDING_MODEL, input: texts }),
      signal: timeoutSignal(120_000),
    })
  } catch (error) {
    throw new OllamaError(
      `Could not reach Ollama at ${OLLAMA_BASE_URL}. Start it and run \`ollama pull ${OLLAMA_EMBEDDING_MODEL}\`.` +
        (error instanceof Error ? ` (${error.message})` : ""),
    )
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    throw new OllamaError(
      `Ollama embed returned ${response.status}: ${detail.slice(0, 300)}. ` +
        `Is \`ollama pull ${OLLAMA_EMBEDDING_MODEL}\` done?`,
      response.status,
    )
  }

  const payload = (await response.json().catch(() => ({}))) as { embeddings?: number[][] }
  const embeddings = Array.isArray(payload.embeddings) ? payload.embeddings : []

  if (embeddings.length !== texts.length) {
    throw new OllamaError(
      `Ollama returned ${embeddings.length} embeddings for ${texts.length} inputs`,
    )
  }

  return embeddings.map((vector) => {
    const values = Array.isArray(vector) ? vector.map(Number) : []
    if (values.length !== EMBEDDING_DIMENSIONS) {
      throw new OllamaError(
        `Expected ${EMBEDDING_DIMENSIONS}-dim embeddings, got ${values.length}. ` +
          `Set OLLAMA_EMBEDDING_MODEL to a ${EMBEDDING_DIMENSIONS}-dim model.`,
      )
    }
    return normalise(values)
  })
}

/** Vector literal for pgvector RPC parameters. */
export function toVectorLiteral(values: number[]): string {
  return `[${values.join(",")}]`
}

/**
 * True when the local models are the intended backend.
 *
 * Mirrors `shouldUseLocalChatService` in local-chat.ts: an explicit
 * `AI_PROVIDER` always wins, and the unset default picks Ollama when no Gemini
 * key exists. Adding a key later restores cloud behaviour with no code change.
 *
 * Named `isOllamaEnabled`, not `useOllama`: the `use` prefix made ESLint treat
 * this plain predicate as a React hook and report a rules-of-hooks violation at
 * every non-component call site.
 */
export function isOllamaEnabled(): boolean {
  const provider = (process.env.AI_PROVIDER ?? "").trim().toLowerCase()
  if (provider === "gemini" || provider === "openai") return false
  if (provider === "ollama" || provider === "stub") return true
  // auto: only fall back to a local model when no hosted key is configured.
  const hasHostedKey =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim()
  return !hasHostedKey
}
