export const DEMO_DOCUMENTS_COOKIE = "mfu_demo_documents"
export const DEMO_DOCUMENTS_MAX_ITEMS = 8
export const DEMO_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7

export type DemoDocumentRecord = {
  id: string
  file_name: string
  mime_type: string | null
  size_bytes: number
  object_key: string
  bucket: string
  region: string
  gemini_store_name?: string | null
  gemini_document_name?: string | null
  gemini_index_status?: "pending" | "ready" | "failed" | "skipped"
  gemini_index_error?: string | null
  gemini_indexed_at?: string | null
  created_at: string
}

type DemoDocumentsPayload = {
  email: string
  documents: DemoDocumentRecord[]
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function normalizeStatus(value: unknown): DemoDocumentRecord["gemini_index_status"] {
  return value === "pending" || value === "ready" || value === "failed" || value === "skipped" ? value : undefined
}

function normalizeRecord(value: any): DemoDocumentRecord | null {
  if (!value || typeof value !== "object") return null
  if (typeof value.id !== "string" || typeof value.file_name !== "string" || typeof value.object_key !== "string") {
    return null
  }

  const createdAt =
    typeof value.created_at === "string" && value.created_at ? value.created_at : new Date().toISOString()

  return {
    id: value.id,
    file_name: value.file_name,
    mime_type: typeof value.mime_type === "string" ? value.mime_type : null,
    size_bytes: Number.isFinite(value.size_bytes) ? Number(value.size_bytes) : 0,
    object_key: value.object_key,
    bucket: typeof value.bucket === "string" ? value.bucket : "",
    region: typeof value.region === "string" ? value.region : "",
    gemini_store_name: typeof value.gemini_store_name === "string" ? value.gemini_store_name : null,
    gemini_document_name: typeof value.gemini_document_name === "string" ? value.gemini_document_name : null,
    gemini_index_status: normalizeStatus(value.gemini_index_status),
    gemini_index_error: typeof value.gemini_index_error === "string" ? value.gemini_index_error : null,
    gemini_indexed_at: typeof value.gemini_indexed_at === "string" ? value.gemini_indexed_at : null,
    created_at: createdAt,
  }
}

function sortByCreatedAtDesc(documents: DemoDocumentRecord[]) {
  return [...documents].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

function limitDocuments(documents: DemoDocumentRecord[]) {
  return sortByCreatedAtDesc(documents).slice(0, DEMO_DOCUMENTS_MAX_ITEMS)
}

export function readDemoDocumentsCookie(rawCookie: string | undefined, expectedEmail: string): DemoDocumentRecord[] {
  if (!rawCookie) return []

  try {
    const payload = JSON.parse(rawCookie) as DemoDocumentsPayload
    if (!payload || typeof payload !== "object") return []
    if (typeof payload.email !== "string") return []
    if (normalizeEmail(payload.email) !== normalizeEmail(expectedEmail)) return []
    if (!Array.isArray(payload.documents)) return []

    const normalized = payload.documents.map(normalizeRecord).filter((item): item is DemoDocumentRecord => !!item)
    return limitDocuments(normalized)
  } catch {
    return []
  }
}

export function writeDemoDocumentsCookie(email: string, documents: DemoDocumentRecord[]) {
  const payload: DemoDocumentsPayload = {
    email: normalizeEmail(email),
    documents: limitDocuments(documents),
  }
  return JSON.stringify(payload)
}

export function getLatestReadyDemoStoreName(documents: DemoDocumentRecord[]) {
  return (
    sortByCreatedAtDesc(documents).find((doc) => doc.gemini_index_status === "ready" && doc.gemini_store_name)
      ?.gemini_store_name || null
  )
}

