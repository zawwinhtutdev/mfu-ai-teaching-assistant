"use client"

import { useCallback, useEffect, useRef, useState } from "react"

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
}

const STATUS_STYLE: Record<string, string> = {
  ready: "bg-emerald-100 text-emerald-800",
  queued: "bg-amber-100 text-amber-800",
  processing: "bg-amber-100 text-amber-800",
  failed: "bg-red-100 text-red-800",
}

export function KnowledgeConsole({ canUpload }: { canUpload: boolean }) {
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streaming, setStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState("")
  const [liveSources, setLiveSources] = useState<SourceRecord[]>([])
  const [question, setQuestion] = useState("")
  const [chatError, setChatError] = useState<string | null>(null)

  const bottomRef = useRef<HTMLDivElement | null>(null)

  const loadDocuments = useCallback(async () => {
    const response = await fetch("/api/rag/documents", { cache: "no-store" })
    if (response.ok) setDocuments(await response.json())
  }, [])

  useEffect(() => {
    void loadDocuments()
  }, [loadDocuments])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, streamingText])

  const pollUntilReady = useCallback(
    async (id: string) => {
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
    },
    [],
  )

  const upload = useCallback(
    async (file: File) => {
      setUploading(true)
      setUploadError(null)
      try {
        const form = new FormData()
        form.append("file", file)
        const response = await fetch("/api/rag/documents", { method: "POST", body: form })
        const data = await response.json()
        if (!response.ok) {
          setUploadError(data?.detail ?? data?.error ?? "Upload failed")
          return
        }
        await loadDocuments()
        void pollUntilReady(data.id)
      } catch (error) {
        setUploadError(error instanceof Error ? error.message : "Upload failed")
      } finally {
        setUploading(false)
      }
    },
    [loadDocuments, pollUntilReady],
  )

  const ask = useCallback(async () => {
    const trimmed = question.trim()
    if (!trimmed || streaming) return

    setChatError(null)
    setQuestion("")
    setMessages((current) => [...current, { role: "user", text: trimmed }])
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
            // Deterministic citation repair: show the corrected answer.
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
  }, [messages, question, streaming])

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[320px_1fr]">
      <section className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Course materials</h1>
          <p className="text-muted-foreground text-sm">
            Upload a PDF, then ask questions answered only from its contents.
          </p>
        </div>

        {canUpload ? (
          <>
            <label className="border-border hover:bg-muted/40 flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-dashed p-5 text-center text-sm">
              <span className="font-medium">{uploading ? "Uploading…" : "Choose a PDF"}</span>
              <span className="text-muted-foreground text-xs">up to 25 MB</span>
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                disabled={uploading}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void upload(file)
                  event.target.value = ""
                }}
              />
            </label>
            {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
          </>
        ) : (
          <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-xs">
            Only teachers and administrators can add course materials.
          </p>
        )}

        <ul className="space-y-2">
          {documents.map((doc) => (
            <li key={doc.id} className="border-border rounded-lg border p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <span className="truncate font-medium">{doc.filename}</span>
                <span
                  className={`shrink-0 rounded px-2 py-0.5 text-xs ${
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
            </li>
          ))}
          {documents.length === 0 && (
            <li className="text-muted-foreground text-sm">No documents yet.</li>
          )}
        </ul>
      </section>

      <section className="border-border flex min-h-[70vh] flex-col rounded-lg border">
        <header className="border-border border-b px-4 py-3">
          <h2 className="font-medium">Ask the materials</h2>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {messages.length === 0 && !streamingText && (
            <p className="text-muted-foreground text-sm">
              Answers cite the page and section they came from. If the material does not
              cover something, the assistant says so instead of guessing.
            </p>
          )}

          {messages.map((message, index) => (
            <div key={index} className="space-y-2">
              <div
                className={`w-fit max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground ml-auto"
                    : "bg-muted"
                }`}
              >
                {message.text}
              </div>
              {message.role === "assistant" && message.sources && message.sources.length > 0 && (
                <ul className="space-y-1">
                  {message.sources.map((source) => (
                    <li key={source.n} className="text-muted-foreground text-xs">
                      <span className="text-foreground font-medium">[{source.n}]</span>{" "}
                      {source.citation}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}

          {streamingText && (
            <div className="space-y-2">
              <div className="bg-muted w-fit max-w-[85%] rounded-lg px-3 py-2 text-sm">
                {streamingText}
              </div>
              {liveSources.length > 0 && (
                <ul className="space-y-1">
                  {liveSources.map((source) => (
                    <li key={source.n} className="text-muted-foreground text-xs">
                      <span className="text-foreground font-medium">[{source.n}]</span>{" "}
                      {source.citation}
                    </li>
                  ))}
                </ul>
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
            placeholder="Which status code is used when the user is not authenticated?"
            className="border-border focus-visible:ring-ring flex-1 rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2"
            disabled={streaming}
          />
          <button
            type="submit"
            disabled={streaming || !question.trim()}
            className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm disabled:opacity-50"
          >
            {streaming ? "…" : "Ask"}
          </button>
        </form>
      </section>
    </div>
  )
}
