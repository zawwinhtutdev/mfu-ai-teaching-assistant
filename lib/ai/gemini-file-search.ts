import { GoogleGenAI, type UploadToFileSearchStoreOperation } from "@google/genai"
import { isSupportedDocument, resolveDocumentMimeType } from "@/lib/documents/supported-formats"
import { geminiModelName } from "@/lib/ai/models"

const FILE_SEARCH_POLL_INTERVAL_MS = 1500
const FILE_SEARCH_MAX_POLLS = 40
const NO_CONTEXT_SENTINEL = "__NO_CONTEXT__"

type SupabaseLikeClient = {
  from: (table: string) => {
    select: (columns: string) => any
  }
}

type IndexDocumentParams = {
  supabase?: SupabaseLikeClient | null
  userId: string
  fileName: string
  mimeType: string
  fileBuffer: Buffer
  existingStoreName?: string | null
}

export type GeminiDocumentIndexResult = {
  status: "ready" | "failed" | "skipped"
  storeName: string | null
  documentName: string | null
  error: string | null
}

function getGeminiApiKey() {
  return process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY || null
}

function createGeminiClient() {
  const apiKey = getGeminiApiKey()
  if (!apiKey) {
    throw new Error("Missing Gemini API key for file search")
  }
  return new GoogleGenAI({ apiKey })
}

function safeStoreDisplayName(userId: string) {
  const short = userId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) || "user"
  return `docs-${short}`
}

export function extractStoreNameFromDocumentName(documentName?: string | null) {
  const raw = documentName?.trim()
  if (!raw) return null
  const marker = "/documents/"
  const idx = raw.indexOf(marker)
  if (idx <= 0) return null
  return raw.slice(0, idx)
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForUploadOperation(ai: GoogleGenAI, operation: UploadToFileSearchStoreOperation) {
  let current = operation
  for (let i = 0; i < FILE_SEARCH_MAX_POLLS; i++) {
    if (current.done) {
      return current
    }
    await sleep(FILE_SEARCH_POLL_INTERVAL_MS)
    current = (await ai.operations.get({ operation: current })) as UploadToFileSearchStoreOperation
  }
  return current
}

export async function getUserGeminiFileSearchStoreName(supabase: SupabaseLikeClient, userId: string) {
  try {
    const { data, error } = await supabase
      .from("user_documents")
      .select("gemini_store_name, gemini_document_name")
      .eq("user_id", userId)
      .eq("gemini_index_status", "ready")
      .order("created_at", { ascending: false })
      .limit(20)

    if (error) {
      return null
    }

    const rows = Array.isArray(data) ? data : data ? [data] : []
    for (const row of rows) {
      if (row?.gemini_store_name) return row.gemini_store_name
      const derived = extractStoreNameFromDocumentName(row?.gemini_document_name)
      if (derived) return derived
    }
    return null
  } catch {
    return null
  }
}

export async function indexDocumentToGeminiFileSearch(
  params: IndexDocumentParams,
): Promise<GeminiDocumentIndexResult> {
  const { supabase, userId, fileName, mimeType, fileBuffer } = params

  if (!isSupportedDocument(fileName, mimeType)) {
    return {
      status: "skipped",
      storeName: params.existingStoreName || null,
      documentName: null,
      error: "Unsupported document format",
    }
  }

  if (!getGeminiApiKey()) {
    return {
      status: "failed",
      storeName: params.existingStoreName || null,
      documentName: null,
      error: "Gemini API key is not configured",
    }
  }

  try {
    const ai = createGeminiClient()
    let storeName =
      params.existingStoreName || (supabase ? await getUserGeminiFileSearchStoreName(supabase, userId) : null)

    if (!storeName) {
      const createdStore = await ai.fileSearchStores.create({
        config: {
          displayName: safeStoreDisplayName(userId),
        },
      })
      storeName = createdStore.name || null
    }

    if (!storeName) {
      return {
        status: "failed",
        storeName: null,
        documentName: null,
        error: "Failed to create Gemini file search store",
      }
    }

    const resolvedMimeType = resolveDocumentMimeType(fileName, mimeType)
    const fileBlob = new Blob([new Uint8Array(fileBuffer)], { type: resolvedMimeType })
    const uploadOperation = await ai.fileSearchStores.uploadToFileSearchStore({
      fileSearchStoreName: storeName,
      file: fileBlob,
      config: {
        mimeType: resolvedMimeType,
        displayName: fileName,
      },
    })

    const finalized = await waitForUploadOperation(ai, uploadOperation)
    if (!finalized.done) {
      return {
        status: "failed",
        storeName,
        documentName: null,
        error: "Gemini file indexing timed out",
      }
    }

    if (finalized.error) {
      const message = typeof finalized.error?.message === "string" ? finalized.error.message : "Gemini file indexing failed"
      return {
        status: "failed",
        storeName,
        documentName: null,
        error: message,
      }
    }

    return {
      status: "ready",
      storeName,
      documentName: finalized.response?.documentName || null,
      error: null,
    }
  } catch (error: any) {
    return {
      status: "failed",
      storeName: params.existingStoreName || null,
      documentName: null,
      error: error?.message || "Gemini file indexing failed",
    }
  }
}

export async function getGeminiFileSearchContext(params: { storeName: string; query: string }) {
  const { storeName, query } = params
  if (!query.trim() || !storeName.trim() || !getGeminiApiKey()) {
    return null
  }

  try {
    const ai = createGeminiClient()
    const retrievalModel = process.env.GEMINI_FILE_SEARCH_MODEL || geminiModelName()
    const result = await ai.models.generateContent({
      model: retrievalModel,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: [
                "Use file search to retrieve relevant passages from the user's uploaded documents.",
                "Return concise bullet points with document names/citations if available.",
                `If no relevant passage is found, respond with exactly ${NO_CONTEXT_SENTINEL} and nothing else.`,
                "Do not speculate, and do not mention indexing/processing state.",
                `User question: ${query}`,
              ].join("\n"),
            },
          ],
        },
      ],
      config: {
        temperature: 0.1,
        tools: [
          {
            fileSearch: {
              fileSearchStoreNames: [storeName],
              topK: 6,
            },
          },
        ],
      },
    })

    const text = result.text?.trim() || null
    if (!text) return null
    const normalized = text.toLowerCase()
    if (
      text.includes(NO_CONTEXT_SENTINEL) ||
      normalized.includes("still being indexed") ||
      normalized.includes("not yet indexed") ||
      normalized.includes("no usable information") ||
      normalized.includes("no relevant passage") ||
      normalized.includes("no relevant information") ||
      normalized.includes("can't access") ||
      normalized.includes("cannot access") ||
      normalized.includes("could not find relevant")
    ) {
      return null
    }

    return text
  } catch (error) {
    console.error("Gemini file search retrieval failed:", error)
    return null
  }
}

export async function deleteGeminiFileSearchDocument(params: { documentName?: string | null }) {
  const documentName = params.documentName?.trim()
  if (!documentName || !getGeminiApiKey()) {
    return
  }

  try {
    const ai = createGeminiClient()
    await ai.fileSearchStores.documents.delete({ name: documentName })
  } catch (error) {
    console.error("Failed to delete Gemini file-search document:", error)
  }
}
