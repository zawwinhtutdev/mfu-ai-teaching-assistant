/**
 * Server-side PDF parsing needs browser globals.
 *
 * `pdf-parse` v2 bundles pdf.js, whose legacy build still reads `DOMMatrix`,
 * `ImageData` and `Path2D` from the global scope. Node and serverless runtimes
 * do not define them, so importing the package threw
 * "ReferenceError: DOMMatrix is not defined" on every PDF upload, before any
 * text was read.
 *
 * Install the missing globals before importing the module. `dommatrix` is a
 * pure-JS DOMMatrix implementation; the other two are only used by rendering
 * paths, which text extraction never enters, so small stand-ins are enough.
 *
 * Both call sites import this helper instead of importing pdf-parse directly:
 *   lib/ai/course-rag.ts      course material indexing
 *   app/api/chat/route.ts     chat attachments / PDF fallback
 */
let loadPromise: Promise<(buffer: Buffer) => Promise<string>> | null = null

async function installPdfJsGlobals() {
  const scope = globalThis as any
  if (typeof scope.DOMMatrix === "undefined") {
    const dommatrix: any = await import("dommatrix")
    scope.DOMMatrix = dommatrix?.default ?? dommatrix
  }
  if (typeof scope.ImageData === "undefined") {
    scope.ImageData = class ImageData {}
  }
  if (typeof scope.Path2D === "undefined") {
    scope.Path2D = class Path2D {}
  }
}

async function createParser() {
  await installPdfJsGlobals()
  const mod: any = await import("pdf-parse")

  // v2: class-based API.
  const PDFParseCtor = mod?.PDFParse ?? mod?.default?.PDFParse
  if (typeof PDFParseCtor === "function") {
    return async (buffer: Buffer) => {
      const parser = new PDFParseCtor({ data: new Uint8Array(buffer) })
      try {
        const result = await parser.getText()
        const text = typeof result === "string" ? result : result?.text
        return typeof text === "string" ? text : ""
      } finally {
        // getText keeps the document handle open; without this the worker
        // leaks across uploads.
        await parser.destroy?.().catch?.(() => {})
      }
    }
  }

  // v1: default-exported function, kept for pinned old installations.
  const legacy = mod?.default ?? mod
  if (typeof legacy === "function") {
    return async (buffer: Buffer) => {
      const parsed = await legacy(buffer)
      return typeof parsed?.text === "string" ? parsed.text : ""
    }
  }

  throw new Error("Unsupported pdf-parse version: no PDFParse class or default function found")
}

function getParser() {
  loadPromise ??= createParser()
  return loadPromise
}

/** Extract raw text from a PDF buffer with the required globals in place. */
export async function extractPdfTextFromBuffer(buffer: Buffer): Promise<string> {
  const parse = await getParser()
  return parse(buffer)
}
