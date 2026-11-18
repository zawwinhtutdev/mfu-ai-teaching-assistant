/**
 * Provider options for every Gemini call.
 *
 * Gemini 2.5+ models spend "thinking" tokens out of the same budget as the
 * visible answer. With the app's 600-token cap, a measured request burned 574
 * tokens on internal reasoning and returned a truncated sentence with
 * `finishReason: MAX_TOKENS`. Disabling the thinking budget made the same
 * request finish normally in 989ms using 55 tokens instead of 3822ms and 605.
 *
 * These are teaching-assistant answers over retrieved course context, not
 * multi-step reasoning tasks, so the internal reasoning cost was pure loss.
 */
export function googleThinkingOff() {
  return { google: { thinkingConfig: { thinkingBudget: 0 } } }
}

/**
 * Gemini model name for server-side calls.
 *
 * Google retires model ids on its own schedule, and a retired id fails every AI
 * route with a 404 from the provider. These names were previously hardcoded in
 * four modules, so recovering from a retirement meant editing code and
 * rebuilding the image. `GEMINI_MODEL` lets an operator change it with a
 * restart instead.
 *
 * The FastAPI service reads the same setting through `CHAT_MODEL`.
 */
export function geminiModelName(): string {
  const configured = process.env.GEMINI_MODEL?.trim()
  return configured || "gemini-2.5-flash"
}

export type ModelConfig = {
  id: string
  label: string
  providerModel: string
  systemPrompt: string
  maxOutputTokens?: number
  temperature?: number
  enabled?: boolean
}

/**
 * Redirect model ids that are no longer usable to the one that is.
 *
 * These mappings used to point the other way — forward to the newest model —
 * which is how `gemini-2.5-flash` requests ended up calling `gemini-3.8-flash`.
 * That model now answers 503 UNAVAILABLE for this key, and because the alias
 * table silently rewrote the id, changing `MODEL_CONFIGS` had no effect and
 * every chat stream hung with no answer.
 *
 * Rows already stored in the database (courses.ai_model, chatbot_settings)
 * may still name a retired id, so they must be redirected here rather than
 * requiring a data migration.
 */
const GOOGLE_MODEL_ALIASES: Record<string, string> = {
  "google/gemini-3.8-flash": "google/gemini-2.5-flash",
  "google/gemini-3.5-flash": "google/gemini-2.5-flash",
  "google/gemini-3-flash": "google/gemini-2.5-flash",
  "google/gemini-3-flash-preview": "google/gemini-2.5-flash",
  "google/gemini-3.1-pro-preview": "google/gemini-2.5-flash",
  "google/gemini-3-pro-preview": "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-lite": "google/gemini-2.5-flash",
  "google/gemini-2.5-pro": "google/gemini-2.5-flash",
}

export const normalizeGoogleProviderModel = (providerModel: string) =>
  GOOGLE_MODEL_ALIASES[providerModel] ?? providerModel

/**
 * Ordered models to try for a request.
 *
 * Free-tier Gemini keys are unreliable: during testing `gemini-3.8-flash` and
 * `gemini-3.5-flash` answered 503 UNAVAILABLE on every attempt while
 * `gemini-2.5-flash` and `gemini-3.1-flash-lite` worked. A 503 is a transient
 * capacity rejection, not a bad request, so retrying the same prompt on a
 * different model usually succeeds and is far better than telling a student the
 * assistant is broken.
 *
 * The requested model is always tried first; the rest are fallbacks.
 */
export function geminiModelCandidates(requested?: string): string[] {
  const ordered: string[] = []

  if (requested?.startsWith("google/")) {
    ordered.push(requested.replace("google/", ""))
  }

  const configured = process.env.GEMINI_MODEL?.trim()
  if (configured) ordered.push(configured)

  // Measured as available and reliable with a free-tier key.
  ordered.push("gemini-2.5-flash", "gemini-3.1-flash-lite")

  // De-duplicate while preserving order.
  return [...new Set(ordered.filter(Boolean))]
}

/** True when an error means "try another model" rather than "this is broken". */
export function isRetryableModelError(error: unknown): boolean {
  const text = collectText(error).toLowerCase()
  return (
    text.includes("503") ||
    text.includes("unavailable") ||
    text.includes("429") ||
    text.includes("resource_exhausted") ||
    text.includes("overloaded") ||
    text.includes("high demand")
  )
}

function collectText(error: unknown, depth = 0): string {
  if (depth > 2 || error == null) return ""
  if (typeof error === "string") return error
  if (error instanceof Error) {
    const nested = "cause" in error ? collectText(error.cause, depth + 1) : ""
    return `${error.message} ${nested}`
  }
  if (typeof error !== "object") return String(error)
  const value = error as Record<string, unknown>
  return [value.message, value.statusCode, value.responseBody, value.cause]
    .map((item) => collectText(item, depth + 1))
    .filter(Boolean)
    .join(" ")
}

export const MODEL_CONFIGS: ModelConfig[] = [
  {
    id: "default",
    label: "Default Assistant",
    providerModel: "google/gemini-2.5-flash",
    systemPrompt: `You are a helpful and concise AI assistant. Be direct and friendly.`,
    maxOutputTokens: 600,
    temperature: 0.5,
    enabled: true,
  },
  {
    id: "mfumodelbeta",
    label: "MFU Info Guide",
    providerModel: "google/gemini-2.5-flash",
    systemPrompt: `You are MFU Guide about the university and its information. Focus on MFU: campus, services, offices, policies, contacts, admissions, fees, facilities, events. If unrelated to MFU, politely decline and steer back to MFU topics. Identify yourself as "MFU Guide".`,
    maxOutputTokens: 1200,
    temperature: 0.6,
    enabled: true,
  },
  {
    id: "mfumodelbeta2",
    label: "MFU Lecture Assistant",
    providerModel: "google/gemini-2.5-flash",
    systemPrompt: `You are MFU Guide about studying and courses. Help with lectures, coursework, summaries, explanations, study tips, and course planning for MFU students. Avoid non-study topics. Identify yourself as "MFU Guide".`,
    maxOutputTokens: 1400,
    temperature: 0.55,
    enabled: true,
  },
  {
    id: "mfuaiteachingassistant",
    label: "MFU AI Teaching Assistant",
    providerModel: "google/gemini-2.5-flash",
    systemPrompt: `You are an MFU AI Teaching Assistant focused only on studying. Assist with concepts, assignments, quizzes, study strategies, and explanations. Refuse to answer unrelated topics and guide users back to study-related questions.`,
    maxOutputTokens: 1200,
    temperature: 0.5,
    enabled: false,
  },
  {
    id: "mfumodel",
    label: "MFU Special Info",
    providerModel: "google/gemini-2.5-flash",
    systemPrompt: `You provide special information about MFU (internal facts, highlights, unique programs, notable resources). Keep responses MFU-specific; when unsure, recommend official MFU sources. Identify yourself as "MFU Guide".`,
    maxOutputTokens: 1200,
    temperature: 0.55,
    enabled: false,
  },
]

export const getModelConfig = (id?: string) =>
  MODEL_CONFIGS.find((m) => m.id === id) ?? MODEL_CONFIGS[0]
