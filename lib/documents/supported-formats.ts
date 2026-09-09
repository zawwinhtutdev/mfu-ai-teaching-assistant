const MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".odt": "application/vnd.oasis.opendocument.text",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".csv": "text/csv",
  ".json": "application/json",
  ".html": "text/html",
  ".htm": "text/html",
  ".xml": "application/xml",
}

const SUPPORTED_MIME_TYPES = new Set(Object.values(MIME_TYPE_BY_EXTENSION))

export const DOCUMENT_UPLOAD_ACCEPT = Object.keys(MIME_TYPE_BY_EXTENSION).join(",")
export const DOCUMENT_UPLOAD_FORMATS_LABEL =
  "PDF, Word, PowerPoint, Excel, OpenDocument, TXT, Markdown, CSV, JSON, HTML, and XML"
// Keep multipart requests below Vercel Functions' 4.5 MB request-body limit.
export const MAX_DOCUMENT_UPLOAD_BYTES = 4 * 1024 * 1024

function getExtension(fileName: string) {
  const match = fileName.trim().toLowerCase().match(/\.[^.]+$/)
  return match?.[0] || ""
}

export function resolveDocumentMimeType(fileName: string, mimeType?: string | null) {
  const normalizedMime = (mimeType || "").trim().toLowerCase()
  if (SUPPORTED_MIME_TYPES.has(normalizedMime)) return normalizedMime

  return MIME_TYPE_BY_EXTENSION[getExtension(fileName)] || normalizedMime || "application/octet-stream"
}

export function isSupportedDocument(fileName: string, mimeType?: string | null) {
  const extension = getExtension(fileName)
  const normalizedMime = (mimeType || "").trim().toLowerCase()
  return Boolean(MIME_TYPE_BY_EXTENSION[extension] || SUPPORTED_MIME_TYPES.has(normalizedMime))
}

export function isPdfDocument(fileName: string, mimeType?: string | null) {
  return resolveDocumentMimeType(fileName, mimeType) === "application/pdf"
}
