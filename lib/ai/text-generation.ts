/**
 * Provider-agnostic one-shot text generation.
 *
 * Summarization, quizzes and flashcards were hard-wired to Gemini, so with no
 * API key (the default local setup) they all threw and the student-facing study
 * tools were dead. This routes them through the same switch chat already uses:
 * Ollama locally, Gemini when a key is present.
 */

import { generateText as aiGenerateText, Output } from "ai"
import { createGoogle } from "@ai-sdk/google"
import type { z } from "zod"

import { streamChat, isOllamaEnabled } from "@/lib/ai/ollama"

/** Collect a streamed completion into one string. */
async function ollamaComplete(prompt: string, system?: string): Promise<string> {
  const messages = [
    ...(system ? [{ role: "system" as const, content: system }] : []),
    { role: "user" as const, content: prompt },
  ]

  let text = ""
  for await (const delta of streamChat(messages)) text += delta
  return text.trim()
}

function geminiModel() {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!apiKey) {
    throw new Error(
      "No AI provider available: start Ollama (AI_PROVIDER=ollama) or set GOOGLE_GENERATIVE_AI_API_KEY.",
    )
  }
  return createGoogle({ apiKey })("gemini-3.8-flash")
}

/** Free-text completion. */
export async function completeText(prompt: string, options: { system?: string } = {}) {
  if (isOllamaEnabled()) {
    return ollamaComplete(prompt, options.system)
  }

  const { text } = await aiGenerateText({
    model: geminiModel(),
    prompt,
    ...(options.system ? { instructions: options.system } : {}),
  } as any)

  return text.trim()
}

/**
 * Structured completion validated against a Zod schema.
 *
 * Ollama has no native structured-output mode, so the model is asked for bare
 * JSON and the reply is parsed defensively: models sometimes wrap JSON in
 * prose or a fenced block. A parse failure is surfaced rather than silently
 * returning an empty list, because "no flashcards" looks like a bug to a user.
 */
export async function completeStructured<T>(
  prompt: string,
  schema: z.ZodType<T>,
  options: { system?: string } = {},
): Promise<T> {
  if (!isOllamaEnabled()) {
    const { output } = await aiGenerateText({
      model: geminiModel(),
      output: Output.object({ schema }),
      prompt,
      ...(options.system ? { instructions: options.system } : {}),
    } as any)
    return output as T
  }

  const jsonInstruction = [
    options.system,
    "Respond with ONLY a single JSON object. No markdown fences, no commentary before or after.",
  ]
    .filter(Boolean)
    .join("\n")

  const raw = await ollamaComplete(prompt, jsonInstruction)
  const parsed = extractJson(raw)

  if (parsed === null) {
    throw new Error(`The model did not return valid JSON. First 200 characters: ${raw.slice(0, 200)}`)
  }

  const result = schema.safeParse(parsed)
  if (!result.success) {
    throw new Error(`The model's JSON did not match the expected shape: ${result.error.message}`)
  }

  return result.data
}

/** Pull the first JSON object/array out of a model reply. */
function extractJson(raw: string): unknown | null {
  const trimmed = raw.trim()

  // Strip a fenced block if present.
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fenced ? fenced[1].trim() : trimmed

  try {
    return JSON.parse(candidate)
  } catch {
    // Fall back to the outermost {...} or [...] span.
    const start = candidate.search(/[{[]/)
    if (start === -1) return null
    const closer = candidate[start] === "{" ? "}" : "]"
    const end = candidate.lastIndexOf(closer)
    if (end <= start) return null
    try {
      return JSON.parse(candidate.slice(start, end + 1))
    } catch {
      return null
    }
  }
}
