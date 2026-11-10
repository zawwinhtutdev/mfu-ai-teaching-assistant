"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Check, FileText, Sparkles, Upload, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface DocumentRecord {
  id: string
  filename: string
  status: string
  error?: string | null
  page_count?: number | null
  chunk_count: number
  size_bytes?: number | null
}

interface SourceRecord {
  n: number
  filename: string
  page_from?: number | null
  page_to?: number | null
  section?: string | null
  snippet?: string
  citation: string
}

interface ChatMessage {
  role: "user" | "assistant"
  text: string
  sources?: SourceRecord[]
  scopedFilenames?: string[]
}

const STATUS_STYLE: Record<string, string> = {
  ready: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
  queued: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  processing: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300",
}

const QUICK_PROMPTS = [
  "Summarize the main points in 3–5 bullet points",
  "List key concepts and definitions",
  "What are the most important takeaways for exams?",
]

/**
 * Normalizes LLM output so inline bullet points (e.g. `... [1]. - **Item**`)
 * and consecutive duplicate citations (e.g. `[2] [2]`) render cleanly as Markdown.
 */
function normalizeAssistantMarkdown(raw: string): string {
  return raw
    .replace(/(\[\d+\])(?:\s*\1)+/g, "$1")
    .replace(/([.!?\]])\s+-\s+(?=\*\*|[A-Z0-9])/g, "$1\n- ")
    .replace(/^([^\n]+?:)\s+-\s+(?=\*\*|[A-Z0-9])/gm, "$1\n- ")
    .replace(/(\[\d+\])\s+([.,;:])/g, "$1$2")
}

function renderInlineCitations(children: ReactNode): ReactNode {
  if (typeof children === "string") {
    const parts = children.split(/(\[\d+\])/g)
    if (parts.length === 1) return children
    return parts.map((part, idx) =>
      /^\[\d+\]$/.test(part) ? (
        <span
          key={idx}
          className="mx-0.5 inline-flex items-center rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary align-baseline"
        >
          {part}
        </span>
      ) : (
        part
      ),
    )
  }
  if (Array.isArray(children)) {
    return children.map((child, idx) => (
      <span key={idx}>{renderInlineCitations(child)}</span>
    ))
  }
  return children
}

function AssistantMarkdown({ content }: { content: string }) {
  const normalized = useMemo(() => normalizeAssistantMarkdown(content), [content])

  return (
    <div className="text-sm leading-relaxed text-foreground">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p className="mb-2.5 last:mb-0 leading-relaxed">{renderInlineCitations(children)}</p>
          ),
          ul: ({ children }) => (
            <ul className="my-2 list-disc pl-5 space-y-1.5 first:mt-0 last:mb-0">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2 list-decimal pl-5 space-y-1.5 first:mt-0 last:mb-0">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed pl-0.5 [&>p]:mb-1 [&>p:last-child]:mb-0">
              {renderInlineCitations(children)}
            </li>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{renderInlineCitations(children)}</strong>
          ),
          h1: ({ children }) => (
            <h1 className="mt-3 mb-1.5 text-base font-bold first:mt-0">{renderInlineCitations(children)}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-3 mb-1.5 text-[15px] font-bold first:mt-0">{renderInlineCitations(children)}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-2.5 mb-1 text-sm font-semibold first:mt-0">{renderInlineCitations(children)}</h3>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-2 border-primary/40 pl-3 italic text-muted-foreground">
              {children}
            </blockquote>
          ),
          code: ({ className, children, ...props }) => {
            const isBlock = /language-(\w+)/.test(className || "")
            if (isBlock) {
              return (
                <pre className="my-2 overflow-x-auto rounded-md bg-zinc-900 p-3 text-xs text-zinc-100">
                  <code className={className} {...props}>
                    {String(children).replace(/\n$/, "")}
                  </code>
                </pre>
              )
            }
            return (
              <code className="rounded bg-background/80 px-1.5 py-0.5 font-mono text-xs" {...props}>
                {children}
              </code>
            )
          },
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto">
              <table className="w-full border-collapse text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-border bg-background/60 px-2.5 py-1.5 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-border px-2.5 py-1.5">{renderInlineCitations(children)}</td>
          ),
        }}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  )
}

export interface CourseOption {
  id: string
  code: string
  title: string
}

export function KnowledgeConsole({
  canUpload,
  courses = [],
}: {
  canUpload: boolean
  courses?: CourseOption[]
}) {
  const [courseId, setCourseId] = useState<string>(courses[0]?.id ?? "")
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragDepthRef = useRef(0)

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streaming, setStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState("")
  const [liveSources, setLiveSources] = useState<SourceRecord[]>([])
  const [question, setQuestion] = useState("")
  const [chatError, setChatError] = useState<string | null>(null)

  const bottomRef = useRef<HTMLDivElement | null>(null)

  const readyDocuments = useMemo(
    () => documents.filter((doc) => doc.status === "ready"),
    [documents],
  )

  const selectedDocuments = useMemo(
    () => readyDocuments.filter((doc) => selectedDocIds.includes(doc.id)),
    [readyDocuments, selectedDocIds],
  )

  const activeCourse = useMemo(
    () => courses.find((c) => c.id === courseId),
    [courses, courseId],
  )

  const loadDocuments = useCallback(async () => {
    const query = courseId ? `?course_id=${encodeURIComponent(courseId)}` : ""
    const response = await fetch(`/api/rag/documents${query}`, { cache: "no-store" })
    if (response.ok) {
      const list: DocumentRecord[] = await response.json()
      setDocuments(list)
      setSelectedDocIds((prev) => prev.filter((id) => list.some((d) => d.id === id)))
    } else {
      setDocuments([])
      setSelectedDocIds([])
    }
  }, [courseId])

  useEffect(() => {
    void loadDocuments()
  }, [loadDocuments])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, streamingText])

  const pollUntilReady = useCallback(async (id: string) => {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const response = await fetch(`/api/rag/documents/${id}`, { cache: "no-store" })
      if (!response.ok) break
      const record: DocumentRecord = await response.json()
      setDocuments((current) =>
        current.map((doc) => (doc.id === id ? { ...doc, ...record } : doc)),
      )
      if (record.status === "ready" || record.status === "failed") return
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
  }, [])

  const uploadFiles = useCallback(
    async (incoming: FileList | File[]) => {
      const files = Array.from(incoming)
      if (files.length === 0) return

      const pdfFiles = files.filter(
        (file) =>
          file.type === "application/pdf" ||
          file.name.toLowerCase().endsWith(".pdf"),
      )
      if (pdfFiles.length === 0) {
        setUploadError("Only PDF files (.pdf) are supported.")
        return
      }

      const oversized = pdfFiles.find((file) => file.size > 25 * 1024 * 1024)
      if (oversized) {
        setUploadError(`"${oversized.name}" exceeds the 25 MB limit.`)
        return
      }

      setUploading(true)
      setUploadError(null)
      const errors: string[] = []
      if (pdfFiles.length < files.length) {
        errors.push("Skipped non-PDF file(s); only .pdf files are supported.")
      }

      try {
        for (let idx = 0; idx < pdfFiles.length; idx += 1) {
          const file = pdfFiles[idx]
          setUploadProgress(
            pdfFiles.length > 1
              ? `Uploading ${idx + 1}/${pdfFiles.length}: ${file.name}…`
              : `Uploading ${file.name}…`,
          )
          const form = new FormData()
          form.append("file", file)
          if (courseId) form.append("course_id", courseId)
          const response = await fetch("/api/rag/documents", { method: "POST", body: form })
          const data = await response.json()
          if (!response.ok) {
            errors.push(`${file.name}: ${data?.detail ?? data?.error ?? "Upload failed"}`)
            continue
          }
          await loadDocuments()
          void pollUntilReady(data.id)
        }
        if (errors.length > 0) {
          setUploadError(errors.join(" "))
        }
      } catch (error) {
        setUploadError(error instanceof Error ? error.message : "Upload failed")
      } finally {
        setUploading(false)
        setUploadProgress(null)
      }
    },
    [courseId, loadDocuments, pollUntilReady],
  )

  const toggleDocument = (docId: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId],
    )
  }

  const ask = useCallback(
    async (overrideQuestion?: string) => {
      const trimmed = (overrideQuestion ?? question).trim()
      if (!trimmed || streaming || readyDocuments.length === 0) return

      const scopedFilenames =
        selectedDocuments.length > 0 ? selectedDocuments.map((d) => d.filename) : undefined
      const scopedDocIds =
        selectedDocuments.length > 0 ? selectedDocuments.map((d) => d.id) : undefined

      setChatError(null)
      if (!overrideQuestion) setQuestion("")
      setMessages((current) => [
        ...current,
        { role: "user", text: trimmed, scopedFilenames },
      ])
      setStreaming(true)
      setStreamingText("")
      setLiveSources([])

      let text = ""
      let sources: SourceRecord[] = []

      try {
        const response = await fetch("/api/chat/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [...messages, { role: "user", text: trimmed }].map((message) => ({
              role: message.role,
              content: message.text,
            })),
            top_k: 5,
            ...(courseId ? { course_id: courseId } : {}),
            ...(scopedDocIds ? { document_ids: scopedDocIds } : {}),
          }),
        })

        if (!response.ok || !response.body) {
          const detail = await response.json().catch(() => ({}))
          setChatError(detail?.error ?? `Request failed (${response.status})`)
          setStreaming(false)
          return
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          const events = buffer.split("\n\n")
          buffer = events.pop() ?? ""

          for (const event of events) {
            if (!event.startsWith("data: ")) continue
            const raw = event.slice(6).trim()
            if (!raw || raw === "[DONE]") continue
            const parsed = JSON.parse(raw)

            if (parsed.type === "sources") {
              sources = parsed.sources as SourceRecord[]
              setLiveSources(sources)
            } else if (parsed.type === "delta") {
              text += parsed.text
              setStreamingText(text)
            } else if (parsed.type === "error") {
              setChatError(parsed.message)
            } else if (parsed.type === "done" && parsed.repaired_text) {
              text = parsed.repaired_text as string
              setStreamingText(text)
            }
          }
        }

        setMessages((current) => [...current, { role: "assistant", text, sources }])
      } catch (error) {
        setChatError(error instanceof Error ? error.message : "Chat failed")
      } finally {
        setStreaming(false)
        setStreamingText("")
      }
    },
    [courseId, messages, question, readyDocuments.length, selectedDocuments, streaming],
  )

  const inputPlaceholder =
    readyDocuments.length === 0
      ? "Upload or wait for a PDF to become ready..."
      : selectedDocuments.length === 1
        ? `Ask a question about ${selectedDocuments[0].filename}…`
        : selectedDocuments.length > 1
          ? `Ask a question across ${selectedDocuments.length} selected PDFs…`
          : `Ask a question about ${activeCourse?.code ?? "course"} materials…`

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[340px_1fr]">
      <section className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Course materials</h1>
          <p className="text-muted-foreground text-sm">
            Select one or more PDFs to focus the assistant, or leave all active.
          </p>
        </div>

        {courses.length > 0 && (
          <label className="block text-sm">
            <span className="text-muted-foreground mb-1 block text-xs font-semibold uppercase tracking-wide">
              Course
            </span>
            <select
              value={courseId}
              onChange={(event) => {
                setCourseId(event.target.value)
                setSelectedDocIds([])
                setMessages([])
                setLiveSources([])
                setStreamingText("")
              }}
              className="border-border w-full rounded-lg border bg-transparent px-3 py-2 text-sm"
            >
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code} — {course.title}
                </option>
              ))}
            </select>
          </label>
        )}

        {canUpload ? (
          <>
            <label
              onDragEnter={(event) => {
                event.preventDefault()
                event.stopPropagation()
                dragDepthRef.current += 1
                if (!uploading) setIsDragging(true)
              }}
              onDragOver={(event) => {
                event.preventDefault()
                event.stopPropagation()
                event.dataTransfer.dropEffect = uploading ? "none" : "copy"
                if (!uploading && !isDragging) setIsDragging(true)
              }}
              onDragLeave={(event) => {
                event.preventDefault()
                event.stopPropagation()
                dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
                if (dragDepthRef.current === 0) setIsDragging(false)
              }}
              onDrop={(event) => {
                event.preventDefault()
                event.stopPropagation()
                dragDepthRef.current = 0
                setIsDragging(false)
                if (uploading) return
                if (event.dataTransfer.files?.length) {
                  void uploadFiles(event.dataTransfer.files)
                }
              }}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed p-5 text-center text-sm transition-all",
                isDragging
                  ? "border-primary bg-primary/10 ring-2 ring-primary/25 scale-[1.01]"
                  : "border-border hover:border-primary/50 hover:bg-muted/40",
                uploading && "cursor-wait opacity-75",
              )}
            >
              <Upload
                className={cn(
                  "mb-0.5 h-5 w-5 transition-colors",
                  isDragging ? "text-primary" : "text-muted-foreground",
                )}
              />
              <span className="font-medium">
                {uploadProgress ??
                  (isDragging ? "Drop PDF file(s) here" : "Drag & drop PDF(s) or click to choose")}
              </span>
              <span className="text-muted-foreground text-xs">PDF files up to 25 MB each</span>
              <input
                type="file"
                accept="application/pdf,.pdf"
                multiple
                className="hidden"
                disabled={uploading}
                onChange={(event) => {
                  if (event.target.files?.length) {
                    void uploadFiles(event.target.files)
                  }
                  event.target.value = ""
                }}
              />
            </label>
            {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
          </>
        ) : (
          <p className="text-muted-foreground rounded-lg border border-dashed p-3.5 text-xs">
            Only teachers can add course materials.
          </p>
        )}

        <div className="space-y-2">
          {documents.length > 0 && (
            <div className="flex items-center justify-between gap-2 px-0.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                PDF Files ({readyDocuments.length} ready)
              </span>
              {selectedDocuments.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setSelectedDocIds([])}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Use all ({readyDocuments.length})
                </button>
              ) : (
                <span className="text-[11px] text-muted-foreground">Click a PDF to select</span>
              )}
            </div>
          )}

          <ul className="space-y-2">
            {documents.map((doc) => {
              const isReady = doc.status === "ready"
              const isSelected = selectedDocIds.includes(doc.id)
              return (
                <li key={doc.id}>
                  <button
                    type="button"
                    disabled={!isReady}
                    onClick={() => {
                      if (isReady) toggleDocument(doc.id)
                    }}
                    aria-pressed={isSelected}
                    className={cn(
                      "w-full rounded-xl border p-3 text-left text-sm transition-all",
                      isReady
                        ? "cursor-pointer hover:border-primary/50 hover:bg-muted/30"
                        : "cursor-not-allowed opacity-70",
                      isSelected
                        ? "border-primary bg-primary/5 ring-1 ring-primary/25"
                        : "border-border bg-card",
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        className={cn(
                          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-muted-foreground/40 bg-background",
                          !isReady && "opacity-40",
                        )}
                      >
                        {isSelected && <Check className="h-3 w-3 stroke-[2.5]" />}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <span className="truncate font-medium leading-snug" title={doc.filename}>
                            {doc.filename}
                          </span>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              STATUS_STYLE[doc.status] ?? "bg-muted text-muted-foreground"
                            }`}
                          >
                            {doc.status}
                          </span>
                        </div>
                        <p className="text-muted-foreground mt-1 text-xs">
                          {doc.page_count ? `${doc.page_count} pages · ` : ""}
                          {doc.chunk_count} chunks
                        </p>
                        {doc.error && <p className="mt-1 text-xs text-red-600">{doc.error}</p>}
                      </div>
                    </div>
                  </button>
                </li>
              )
            })}
            {documents.length === 0 && (
              <li className="text-muted-foreground rounded-lg border border-dashed p-4 text-center text-sm">
                No documents yet.
              </li>
            )}
          </ul>
        </div>
      </section>

      <section className="border-border flex min-h-[70vh] flex-col rounded-xl border bg-card">
        <header className="border-border flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <h2 className="font-semibold">Ask the materials</h2>

          <div className="flex flex-wrap items-center gap-1.5">
            {selectedDocuments.length === 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                <FileText className="h-3 w-3" />
                {readyDocuments.length > 0
                  ? `All ready PDFs (${readyDocuments.length})`
                  : "No ready PDFs"}
              </span>
            ) : (
              <>
                {selectedDocuments.map((doc) => (
                  <span
                    key={doc.id}
                    className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                  >
                    <FileText className="h-3 w-3 shrink-0" />
                    <span className="max-w-[180px] truncate">{doc.filename}</span>
                    <button
                      type="button"
                      onClick={() => toggleDocument(doc.id)}
                      className="ml-0.5 rounded-full p-0.5 hover:bg-primary/20"
                      aria-label={`Remove ${doc.filename} from scope`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {selectedDocuments.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setSelectedDocIds([])}
                    className="text-xs text-muted-foreground hover:text-foreground px-1.5"
                  >
                    Clear
                  </button>
                )}
              </>
            )}
          </div>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {messages.length === 0 && !streamingText && (
            <div className="space-y-3 py-2">
              <p className="text-muted-foreground text-sm leading-relaxed">
                {selectedDocuments.length === 1
                  ? `Focused on "${selectedDocuments[0].filename}". Answers will only cite this PDF.`
                  : selectedDocuments.length > 1
                    ? `Focused on ${selectedDocuments.length} selected PDFs. Answers will cite page and section.`
                    : "Select a PDF on the left to ask about a single file, or ask across all course materials. Answers cite the page and section they came from."}
              </p>
              {readyDocuments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {QUICK_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => void ask(prompt)}
                      disabled={streaming}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-muted/50"
                    >
                      <Sparkles className="h-3 w-3 text-primary" />
                      {prompt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {messages.map((message, index) => (
            <div key={index} className="space-y-2">
              {message.role === "user" ? (
                <div className="ml-auto flex w-fit max-w-[85%] flex-col items-end gap-1">
                  {message.scopedFilenames && message.scopedFilenames.length > 0 && (
                    <span className="text-[11px] text-muted-foreground">
                      Scoped to: {message.scopedFilenames.join(", ")}
                    </span>
                  )}
                  <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2.5 text-sm leading-relaxed">
                    {message.text}
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="bg-muted/70 border border-border/60 w-fit max-w-[92%] rounded-2xl rounded-bl-sm px-4 py-3">
                    <AssistantMarkdown content={message.text} />
                  </div>
                  {message.sources && message.sources.length > 0 && (
                    <div className="max-w-[92%] rounded-lg border border-border/60 bg-background/60 px-3 py-2">
                      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Sources
                      </div>
                      <ul className="space-y-1">
                        {message.sources.map((source) => (
                          <li key={source.n} className="text-muted-foreground text-xs leading-snug">
                            <span className="text-foreground font-semibold">[{source.n}]</span>{" "}
                            {source.citation}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {streamingText && (
            <div className="space-y-2.5">
              <div className="bg-muted/70 border border-border/60 w-fit max-w-[92%] rounded-2xl rounded-bl-sm px-4 py-3">
                <AssistantMarkdown content={streamingText} />
              </div>
              {liveSources.length > 0 && (
                <div className="max-w-[92%] rounded-lg border border-border/60 bg-background/60 px-3 py-2">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Sources
                  </div>
                  <ul className="space-y-1">
                    {liveSources.map((source) => (
                      <li key={source.n} className="text-muted-foreground text-xs leading-snug">
                        <span className="text-foreground font-semibold">[{source.n}]</span>{" "}
                        {source.citation}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {chatError && <p className="text-sm text-red-600">{chatError}</p>}
          <div ref={bottomRef} />
        </div>

        <form
          className="border-border flex gap-2 border-t p-3"
          onSubmit={(event) => {
            event.preventDefault()
            void ask()
          }}
        >
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder={inputPlaceholder}
            className="border-border focus-visible:ring-ring flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-2"
            disabled={streaming || readyDocuments.length === 0}
          />
          <button
            type="submit"
            disabled={streaming || !question.trim() || readyDocuments.length === 0}
            className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {streaming ? "…" : "Ask"}
          </button>
        </form>
      </section>
    </div>
  )
}
