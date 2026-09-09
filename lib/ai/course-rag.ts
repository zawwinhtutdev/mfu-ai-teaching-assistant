import { GoogleGenAI } from "@google/genai"

const DEFAULT_EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || "text-embedding-004"
const EMBEDDING_DIMENSIONS = Number(process.env.GEMINI_EMBEDDING_DIMENSIONS || 768)
const MAX_CONTEXT_CHARS = Number(process.env.COURSE_RAG_MAX_CONTEXT_CHARS || 22000)
const MAX_CHUNK_CHARS = Number(process.env.COURSE_RAG_CHUNK_CHARS || 1400)
const CHUNK_OVERLAP_CHARS = Number(process.env.COURSE_RAG_CHUNK_OVERLAP_CHARS || 220)
const EMBED_BATCH_SIZE = Number(process.env.COURSE_RAG_EMBED_BATCH_SIZE || 24)

export type UploadedCourseMaterialFile = {
  fileName: string
  mimeType: string
  buffer: Buffer
}

type SupabaseLikeClient = {
  from: (table: string) => any
  rpc: (fn: string, params?: Record<string, any>) => Promise<{ data: any; error: any }>
}

type RetrievedChunk = {
  material_id: string
  material_title: string | null
  chunk_text: string
  chunk_index: number
  similarity: number
}

function getGeminiApiKey() {
  return process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY || null
}

function createGeminiClient() {
  const apiKey = getGeminiApiKey()
  if (!apiKey) {
    throw new Error("Missing Gemini API key")
  }
  return new GoogleGenAI({ apiKey })
}

function isTextMime(mimeType: string) {
  const lower = mimeType.toLowerCase()
  return (
    lower.startsWith("text/") ||
    lower.includes("json") ||
    lower.includes("xml") ||
    lower.includes("csv") ||
    lower.includes("markdown")
  )
}

function fileNameLooksText(fileName: string) {
  const lower = fileName.toLowerCase()
  return [".txt", ".md", ".csv", ".json", ".xml", ".yaml", ".yml"].some((ext) => lower.endsWith(ext))
}

function isPdfFile(fileName: string, mimeType: string) {
  return mimeType.toLowerCase() === "application/pdf" || fileName.toLowerCase().endsWith(".pdf")
}

function normalizeWhitespace(input: string) {
  return input.replace(/\r\n/g, "\n").replace(/\u0000/g, "").replace(/\n{3,}/g, "\n\n").trim()
}

function splitIntoChunks(text: string, maxChars = MAX_CHUNK_CHARS, overlapChars = CHUNK_OVERLAP_CHARS) {
  const normalized = normalizeWhitespace(text)
  if (!normalized) return []

  const chunks: string[] = []
  let cursor = 0

  while (cursor < normalized.length) {
    let end = Math.min(cursor + maxChars, normalized.length)
    if (end < normalized.length) {
      const paragraphBreak = normalized.lastIndexOf("\n\n", end)
      const sentenceBreak = normalized.lastIndexOf(". ", end)
      const boundary = Math.max(paragraphBreak, sentenceBreak)
      if (boundary > cursor + Math.floor(maxChars * 0.55)) {
        end = boundary + (boundary === sentenceBreak ? 1 : 0)
      }
    }

    const chunk = normalized.slice(cursor, end).trim()
    if (chunk.length > 0) {
      chunks.push(chunk)
    }

    if (end >= normalized.length) break
    cursor = Math.max(end - overlapChars, cursor + 1)
  }

  return chunks
}

function toVectorLiteral(values: number[]) {
  return `[${values.join(",")}]`
}

async function extractPdfText(buffer: Buffer) {
  const pdfParseModule = await import("pdf-parse")
  const pdfParse = (pdfParseModule as any).default || (pdfParseModule as any)
  const parsed = await pdfParse(buffer)
  return typeof parsed?.text === "string" ? normalizeWhitespace(parsed.text) : ""
}

function isAudioFile(fileName: string, mimeType: string) {
  const lower = mimeType.toLowerCase()
  if (lower.startsWith("audio/")) return true
  const ext = fileName.toLowerCase()
  return [".mp3", ".m4a", ".wav", ".ogg", ".webm", ".flac", ".aac"].some((e) => ext.endsWith(e))
}

function getAudioMimeType(fileName: string, mimeType: string) {
  if (mimeType && mimeType !== "application/octet-stream") return mimeType
  const ext = fileName.toLowerCase().split(".").pop()
  const mimeMap: Record<string, string> = {
    mp3: "audio/mpeg",
    m4a: "audio/mp4",
    wav: "audio/wav",
    ogg: "audio/ogg",
    webm: "audio/webm",
    flac: "audio/flac",
    aac: "audio/aac",
  }
  return mimeMap[ext || ""] || "audio/mpeg"
}

async function transcribeAudioWithGemini(buffer: Buffer, fileName: string, mimeType: string): Promise<string> {
  const ai = createGeminiClient()
  const audioMime = getAudioMimeType(fileName, mimeType)
  
  try {
    // Upload audio to Gemini Files API
    const blob = new Blob([new Uint8Array(buffer)], { type: audioMime })
    const file = new File([blob], fileName, { type: audioMime })
    const uploadResult = await ai.files.upload({ file, config: { mimeType: audioMime } })
    
    if (!uploadResult?.uri) {
      console.error("[Audio] Upload failed — no URI returned")
      return ""
    }

    // Wait for file processing
    let fileState = uploadResult
    let attempts = 0
    while (fileState.state === "PROCESSING" && attempts < 30) {
      await new Promise((r) => setTimeout(r, 2000))
      const status = await ai.files.get({ name: fileState.name! })
      if (status) fileState = status as any
      attempts++
    }

    // Transcribe
    const result = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: "Transcribe this audio lecture completely. Output the full transcript text only, no timestamps or speaker labels unless clearly distinct speakers exist." },
            { fileData: { fileUri: uploadResult.uri, mimeType: audioMime } },
          ],
        },
      ],
    })

    const transcript = (result as any)?.text || ""
    return normalizeWhitespace(typeof transcript === "string" ? transcript : "")
  } catch (error: any) {
    console.error("[Audio] Transcription failed:", error?.message || error)
    return ""
  }
}

export async function extractCourseMaterialFileTexts(files: UploadedCourseMaterialFile[]) {
  const parts: Array<{ source: string; text: string }> = []

  for (const file of files) {
    const mimeType = (file.mimeType || "application/octet-stream").toLowerCase()
    const fileName = file.fileName || "attachment"
    let text = ""

    if (isPdfFile(fileName, mimeType)) {
      text = await extractPdfText(file.buffer)
    } else if (isAudioFile(fileName, mimeType)) {
      console.log(`[Audio] Transcribing audio file: ${fileName}`)
      text = await transcribeAudioWithGemini(file.buffer, fileName, mimeType)
      if (text) {
        console.log(`[Audio] Transcription complete: ${text.length} chars`)
      }
    } else if (isTextMime(mimeType) || fileNameLooksText(fileName)) {
      text = normalizeWhitespace(file.buffer.toString("utf-8"))
    }

    if (text) {
      parts.push({ source: fileName, text })
    }
  }

  return parts
}

function combineMaterialSourceText(params: {
  manualContent: string
  extractedParts: Array<{ source: string; text: string }>
}) {
  const sections: string[] = []

  if (params.manualContent.trim()) {
    sections.push(params.manualContent.trim())
  }

  for (const part of params.extractedParts) {
    sections.push(`Source file: ${part.source}\n${part.text}`)
  }

  return normalizeWhitespace(sections.join("\n\n"))
}

async function embedTexts(texts: string[], taskType: "RETRIEVAL_QUERY" | "RETRIEVAL_DOCUMENT") {
  if (texts.length === 0) return []
  const ai = createGeminiClient()

  const vectors: number[][] = []

  for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBED_BATCH_SIZE)
    const response = await ai.models.embedContent({
      model: DEFAULT_EMBEDDING_MODEL,
      contents: batch,
      config: {
        taskType,
        outputDimensionality: EMBEDDING_DIMENSIONS,
      } as any,
    })

    const embeddings = Array.isArray(response.embeddings) ? response.embeddings : []
    for (const item of embeddings) {
      const values = Array.isArray(item?.values) ? item.values : []
      if (values.length > 0) {
        vectors.push(values)
      }
    }
  }

  return vectors
}

export async function indexCourseMaterialContent(params: {
  supabase: SupabaseLikeClient
  courseId: string
  materialId: string
  manualContent: string
  extractedParts: Array<{ source: string; text: string }>
}) {
  const combined = combineMaterialSourceText({
    manualContent: params.manualContent,
    extractedParts: params.extractedParts,
  })

  const chunks = splitIntoChunks(combined)

  const { error: deleteError } = await params.supabase
    .from("course_material_chunks")
    .delete()
    .eq("material_id", params.materialId)

  if (deleteError) {
    throw new Error(deleteError.message || "Failed to clear previous material chunks")
  }

  if (chunks.length === 0) {
    return {
      combinedText: combined,
      chunkCount: 0,
    }
  }

  const vectors = await embedTexts(chunks, "RETRIEVAL_DOCUMENT")
  if (vectors.length !== chunks.length) {
    throw new Error("Embedding count does not match generated chunk count")
  }

  const rows = chunks.map((chunk, index) => ({
    course_id: params.courseId,
    material_id: params.materialId,
    chunk_index: index,
    chunk_text: chunk,
    embedding: toVectorLiteral(vectors[index]),
  }))

  const { error: insertError } = await params.supabase.from("course_material_chunks").insert(rows)
  if (insertError) {
    throw new Error(insertError.message || "Failed to store material chunk vectors")
  }

  return {
    combinedText: combined,
    chunkCount: chunks.length,
  }
}

export async function getCourseMaterialSourceText(params: {
  supabase: SupabaseLikeClient
  materialId: string
  maxChars?: number
}) {
  const maxChars = params.maxChars ?? MAX_CONTEXT_CHARS

  const { data: material, error: materialError } = await params.supabase
    .from("course_materials")
    .select("id,title,content")
    .eq("id", params.materialId)
    .single()

  if (materialError || !material) {
    throw new Error(materialError?.message || "Material not found")
  }

  const { data: chunksData } = await params.supabase
    .from("course_material_chunks")
    .select("chunk_text, chunk_index")
    .eq("material_id", params.materialId)
    .order("chunk_index", { ascending: true })

  const chunks = Array.isArray(chunksData) ? chunksData : []
  const merged = chunks.length
    ? chunks.map((chunk: any) => String(chunk.chunk_text || "")).join("\n\n")
    : String(material.content || "")

  return {
    title: String(material.title || "Material"),
    text: merged.slice(0, maxChars),
    chunkCount: chunks.length,
  }
}

export async function retrieveCourseRagContext(params: {
  supabase: SupabaseLikeClient
  courseId: string
  query: string
  topK?: number
  materialId?: string | null
}) {
  const queryText = params.query.trim()
  if (!queryText) {
    return { context: "", chunks: [] as RetrievedChunk[] }
  }

  const [queryVector] = await embedTexts([queryText], "RETRIEVAL_QUERY")
  if (!queryVector || queryVector.length === 0) {
    return { context: "", chunks: [] as RetrievedChunk[] }
  }

  // Search material chunks
  const { data, error } = await params.supabase.rpc("match_course_material_chunks", {
    p_course_id: params.courseId,
    p_query_embedding: toVectorLiteral(queryVector),
    p_match_count: params.topK ?? 6,
    p_material_id: params.materialId || null,
  })

  if (error) {
    throw new Error(error.message || "Course material retrieval failed")
  }

  const chunks = (Array.isArray(data) ? data : []) as RetrievedChunk[]
  const usable = chunks.filter((chunk) => (chunk?.similarity ?? 0) > 0.15)

  // Also search dedicated FAQs table
  let faqContext = ""
  try {
    const { data: faqData } = await params.supabase.rpc("match_faqs", {
      p_course_id: params.courseId,
      p_query_embedding: toVectorLiteral(queryVector),
      p_match_count: 3,
    })

    const matchedFaqs = (Array.isArray(faqData) ? faqData : [])
      .filter((faq: any) => (faq?.similarity ?? 0) > 0.3)

    if (matchedFaqs.length > 0) {
      faqContext = matchedFaqs
        .map((faq: any) => `[FAQ]\nQ: ${faq.question}\nA: ${faq.answer}`)
        .join("\n\n")
    }
  } catch (faqError: any) {
    // FAQ search is optional — don't fail the whole retrieval
    console.error("[RAG] FAQ search failed:", faqError?.message)
  }

  const materialMerged = usable
    .map(
      (chunk) =>
        `[${chunk.material_title || "Material"} / section ${Number(chunk.chunk_index) + 1}]\n${chunk.chunk_text}`,
    )
    .join("\n\n")

  // FAQ results go first (higher priority), then material chunks
  const merged = [faqContext, materialMerged].filter(Boolean).join("\n\n")

  return {
    context: merged.slice(0, MAX_CONTEXT_CHARS),
    chunks: usable,
  }
}
