/**
 * Audio transcription with a local-first provider order.
 *
 * The original implementation called Gemini unconditionally, which broke the
 * "nothing leaves the machine" promise the moment `AI_PROVIDER=ollama` was set:
 * with no Google key the call threw and the upload produced an empty material
 * that answered nothing. Worse, the failure was swallowed into `""`, so the
 * teacher saw a successful upload of a document that had no text.
 *
 * Order is now:
 *   1. A whisper-family binary on the machine (whisper.cpp `whisper-cli`,
 *      `main`, or the OpenAI `whisper` CLI). Local, no key, no network.
 *   2. Gemini, only when a key exists and the provider allows cloud calls.
 *
 * When neither is available the caller gets a descriptive error instead of an
 * empty string, because an empty transcript is indistinguishable from a lecture
 * with nothing in it.
 */

import { spawn } from "node:child_process"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

const TRANSCRIBE_TIMEOUT_MS = 15 * 60 * 1000

export class TranscriptionUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "TranscriptionUnavailableError"
  }
}

/** Candidate local binaries, most specific first. */
const WHISPER_CANDIDATES = [
  process.env.WHISPER_CLI,
  "whisper-cli",
  "whisper-cpp",
  "main",
  "whisper",
].filter(Boolean) as string[]

function isCloudAllowed(): boolean {
  const provider = (process.env.AI_PROVIDER ?? "").trim().toLowerCase()
  if (provider === "gemini") return Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim())
  if (provider === "ollama" || provider === "stub") return false
  return Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim())
}

async function commandExists(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn("which", [command], { stdio: "ignore" })
    child.on("error", () => resolve(false))
    child.on("close", (code) => resolve(code === 0))
  })
}

/** First local whisper binary that is actually installed, if any. */
async function findWhisperBinary(): Promise<string | null> {
  for (const candidate of WHISPER_CANDIDATES) {
    if (await commandExists(candidate)) return candidate
  }
  return null
}

function run(command: string, args: string[], timeoutMs: number): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"] })
    let stderr = ""
    const timer = setTimeout(() => {
      child.kill("SIGKILL")
      reject(new Error(`${command} timed out after ${Math.round(timeoutMs / 1000)}s`))
    }, timeoutMs)

    child.stderr.on("data", (chunk) => {
      // Bound the buffer: a long transcription can emit a lot of progress noise.
      if (stderr.length < 8000) stderr += chunk.toString()
    })
    child.on("error", (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on("close", (code) => {
      clearTimeout(timer)
      resolve({ code: code ?? 1, stderr })
    })
  })
}

/**
 * Transcribe with a local whisper binary.
 *
 * ffmpeg normalises to the 16 kHz mono WAV that whisper models expect, so a
 * m4a or mp4 lecture does not fail on format. `-nt` and `-oj`/`-otxt` differ
 * between whisper.cpp and the OpenAI CLI, so the flags are chosen per binary.
 */
async function transcribeLocally(
  binary: string,
  buffer: Buffer,
  fileName: string,
): Promise<string> {
  const workDir = await mkdtemp(join(tmpdir(), "ata-audio-"))
  const extension = fileName.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "audio"
  const inputPath = join(workDir, `input.${extension}`)
  const wavPath = join(workDir, "audio.wav")
  const outBase = join(workDir, "transcript")

  try {
    await writeFile(inputPath, buffer)

    // whisper needs 16-bit PCM at 16 kHz mono.
    const ffmpeg = await run(
      "ffmpeg",
      ["-y", "-i", inputPath, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wavPath],
      120_000,
    )
    if (ffmpeg.code !== 0) {
      throw new Error(`ffmpeg could not decode ${fileName}: ${ffmpeg.stderr.slice(-400)}`)
    }

    const isWhisperCpp = binary !== "whisper"
    const model = process.env.WHISPER_MODEL || ""

    if (isWhisperCpp) {
      // whisper.cpp writes <outBase>.txt with -otxt.
      const args = ["-f", wavPath, "-otxt", "-of", outBase, "-nt"]
      if (model) args.push("-m", model)
      const result = await run(binary, args, TRANSCRIBE_TIMEOUT_MS)
      if (result.code !== 0) {
        throw new Error(`${binary} failed: ${result.stderr.slice(-400)}`)
      }
    } else {
      const args = ["--output_format", "txt", "--output_dir", workDir, "--task", "transcribe", wavPath]
      if (model) args.push("--model", model)
      const result = await run(binary, args, TRANSCRIBE_TIMEOUT_MS)
      if (result.code !== 0) {
        throw new Error(`${binary} failed: ${result.stderr.slice(-400)}`)
      }
    }

    const text = await readFile(`${outBase}.txt`, "utf-8").catch(() => "")
    return text.trim()
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {})
  }
}

async function transcribeWithGemini(buffer: Buffer, fileName: string, mimeType: string): Promise<string> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY
  if (!apiKey) {
    throw new TranscriptionUnavailableError("Missing Gemini API key")
  }

  const { GoogleGenAI } = await import("@google/genai")
  const ai = new GoogleGenAI({ apiKey })

  const audioMime = mimeType && mimeType !== "application/octet-stream" ? mimeType : "audio/mpeg"
  const blob = new Blob([new Uint8Array(buffer)], { type: audioMime })
  const file = new File([blob], fileName, { type: audioMime })

  const uploaded = await ai.files.upload({ file, config: { mimeType: audioMime } })
  if (!uploaded?.uri) throw new Error("Gemini upload returned no URI")

  // The file must finish processing before it can be referenced.
  let state = uploaded
  for (let attempt = 0; attempt < 30 && state.state === "PROCESSING"; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2000))
    const status = await ai.files.get({ name: state.name! })
    if (status) state = status as typeof uploaded
  }

  const result = await ai.models.generateContent({
    model: "gemini-3.8-flash",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: "Transcribe this audio lecture completely. Output the full transcript text only, no timestamps or speaker labels unless clearly distinct speakers exist.",
          },
          { fileData: { fileUri: uploaded.uri, mimeType: audioMime } },
        ],
      },
    ],
  })

  return typeof (result as any)?.text === "string" ? (result as any).text.trim() : ""
}

/**
 * Transcribe an audio upload, preferring local execution.
 *
 * Throws `TranscriptionUnavailableError` with install instructions when no
 * provider can run. Callers surface that message rather than storing a material
 * with no text.
 */
export async function transcribeAudio(params: {
  buffer: Buffer
  fileName: string
  mimeType: string
}): Promise<{ text: string; provider: string }> {
  const { buffer, fileName, mimeType } = params

  const binary = await findWhisperBinary()
  if (binary) {
    const text = await transcribeLocally(binary, buffer, fileName)
    return { text, provider: `local:${binary}` }
  }

  if (isCloudAllowed()) {
    const text = await transcribeWithGemini(buffer, fileName, mimeType)
    return { text, provider: "gemini" }
  }

  throw new TranscriptionUnavailableError(
    "Audio transcription is not available on this machine and cloud transcription is disabled " +
      "(AI_PROVIDER is local). Install a local whisper binary — `brew install whisper-cpp` — " +
      "then set WHISPER_MODEL to a downloaded ggml model, or set AI_PROVIDER=gemini with " +
      "GOOGLE_GENERATIVE_AI_API_KEY to transcribe in the cloud.",
  )
}

/** Whether any transcription provider could run right now. */
export async function isTranscriptionAvailable(): Promise<boolean> {
  if (await findWhisperBinary()) return true
  return isCloudAllowed()
}
