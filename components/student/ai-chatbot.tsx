"use client"

import type React from "react"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Send, Bot, User, Paperclip, Smile, X, Loader2, History, Plus, MessageSquare } from "lucide-react"
import type { CourseMaterial, ChatbotSettings } from "@/lib/types"
import { useEffect, useMemo, useRef, useState } from "react"

interface AIChatbotProps {
  courseId: string
  studentId: string
  materials: CourseMaterial[]
  chatbotSettings: ChatbotSettings | null
}

type Attachment = {
  id: string
  name: string
  url: string
  type: string
  uploading: boolean
}

const EMOJIS = [
  "😀", "😄", "😁", "😂", "🙂", "😉", "😍", "🤔",
  "😅", "😢", "😮", "😴", "😎", "🙌", "👍", "👏",
  "🙏", "🎉", "🔥", "✅", "❓", "💡", "📚", "📝",
]

const MARKDOWN_COMPONENTS = {
  p: ({ children }: any) => (
    <p className="mb-2 whitespace-pre-wrap text-sm leading-relaxed last:mb-0">{children}</p>
  ),
  ul: ({ children }: any) => (
    <ul className="mb-2 list-disc space-y-1 pl-5 text-sm leading-relaxed last:mb-0">{children}</ul>
  ),
  ol: ({ children }: any) => (
    <ol className="mb-2 list-decimal space-y-1 pl-5 text-sm leading-relaxed last:mb-0">{children}</ol>
  ),
  li: ({ children }: any) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }: any) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }: any) => <em className="italic">{children}</em>,
  code: ({ children }: any) => (
    <code className="rounded bg-black/10 px-1 py-0.5 text-[0.85em] dark:bg-white/15">{children}</code>
  ),
  pre: ({ children }: any) => (
    <pre className="mb-2 overflow-x-auto rounded-lg bg-black/10 p-3 text-xs leading-relaxed dark:bg-white/10">
      {children}
    </pre>
  ),
  a: ({ href, children }: any) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="underline">
      {children}
    </a>
  ),
  h1: ({ children }: any) => <h3 className="mb-2 text-base font-semibold">{children}</h3>,
  h2: ({ children }: any) => <h3 className="mb-2 text-base font-semibold">{children}</h3>,
  h3: ({ children }: any) => <h4 className="mb-1 text-sm font-semibold">{children}</h4>,
} as const

const MAX_ATTACHMENTS = 5

type ChatSession = {
  id: string
  title: string
  updated_at: string
}

export function AIChatbot({ courseId, studentId, materials, chatbotSettings }: AIChatbotProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [input, setInput] = useState("")
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [isLoadingSessions, setIsLoadingSessions] = useState(true)

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: {
          courseId,
          studentId,
          materials: materials.map((m) => ({ id: m.id, title: m.title, content: m.content })),
          tone: chatbotSettings?.tone || "professional",
          model: chatbotSettings?.ai_model || "google/gemini-3.8-flash",
        },
      }),
    [courseId, studentId, materials, chatbotSettings],
  )

  const { messages, sendMessage, status, setMessages } = useChat({ transport })

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const isBusy = status === "streaming" || status === "submitted"
  const readyAttachments = attachments.filter((attachment) => attachment.url && !attachment.uploading)
  const canSend = Boolean(input.trim()) || readyAttachments.length > 0

  /**
   * Upload through the shared server route rather than straight to Storage:
   * its RLS only allows course-scoped paths, while attachments live under the
   * caller's id prefix. The chip appears immediately and is marked ready once
   * the public URL comes back.
   */
  const uploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploadError(null)

    const room = Math.max(0, MAX_ATTACHMENTS - attachments.length)
    const selected = Array.from(files).slice(0, room)
    if (selected.length === 0) {
      setUploadError(`You can attach up to ${MAX_ATTACHMENTS} files per message.`)
      return
    }

    const pending: Attachment[] = selected.map((file, index) => ({
      id: `${Date.now()}-${index}-${file.name}`,
      name: file.name,
      url: "",
      type: file.type || "application/octet-stream",
      uploading: true,
    }))
    setAttachments((previous) => [...previous, ...pending])

    const form = new FormData()
    selected.forEach((file) => form.append("files", file))

    try {
      const res = await fetch("/api/uploads", { method: "POST", body: form })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Could not upload that file")

      const uploaded: Array<{ name: string; url: string; type?: string }> = Array.isArray(data?.files)
        ? data.files
        : []

      setAttachments((previous) =>
        previous.map((attachment) => {
          if (!attachment.uploading) return attachment
          const match = uploaded.find((file) => file.name === attachment.name)
          return match
            ? { ...attachment, url: match.url, type: match.type || attachment.type, uploading: false }
            : attachment
        }),
      )
    } catch (cause: any) {
      setUploadError(cause?.message || "Could not upload that file")
      setAttachments((previous) => previous.filter((attachment) => !pending.some((item) => item.id === attachment.id)))
    }
  }

  const loadSessions = async (): Promise<ChatSession[]> => {
    try {
      const res = await fetch(`/api/conversations?courseId=${encodeURIComponent(courseId)}`, { cache: "no-store" })
      if (!res.ok) return []
      const data = await res.json()
      return Array.isArray(data?.conversations) ? data.conversations : []
    } catch {
      return []
    }
  }

  /**
   * Resume the newest session for this course so a reload keeps the thread,
   * which is what makes the chat feel like it has memory.
   */
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const list = await loadSessions()
      if (cancelled) return
      setSessions(list)
      setIsLoadingSessions(false)
      if (list.length === 0) return
      try {
        const res = await fetch(`/api/conversations/${list[0].id}`)
        if (!res.ok || cancelled) return
        const data = await res.json()
        const restored = Array.isArray(data?.messages)
          ? data.messages.map((message: any) => ({
              id: message.id,
              role: message.role,
              parts: [{ type: "text" as const, text: message.content }],
            }))
          : []
        if (cancelled) return
        setMessages(restored as any)
        setConversationId(list[0].id)
      } catch {
        // Starting empty is better than blocking the chat.
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId])

  const openSession = async (session: ChatSession) => {
    setHistoryOpen(false)
    try {
      const res = await fetch(`/api/conversations/${session.id}`)
      if (!res.ok) return
      const data = await res.json()
      const restored = Array.isArray(data?.messages)
        ? data.messages.map((message: any) => ({
            id: message.id,
            role: message.role,
            parts: [{ type: "text" as const, text: message.content }],
          }))
        : []
      setMessages(restored as any)
      setConversationId(session.id)
    } catch {
      // Keep the current thread if the session cannot be loaded.
    }
  }

  const startNewChat = () => {
    setMessages([])
    setConversationId(null)
    setHistoryOpen(false)
    setInput("")
    setAttachments([])
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isBusy || !canSend) return

    const text = input.trim()
    let activeConversationId = conversationId

    // Create the session before the first message so the history list has an id
    // immediately and the API can attach the course scope.
    if (!activeConversationId) {
      try {
        const res = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: (text || "Attachment review").slice(0, 60), courseId }),
        })
        if (res.ok) {
          const data = await res.json()
          activeConversationId = data?.conversation?.id ?? null
          if (activeConversationId) setConversationId(activeConversationId)
        }
      } catch {
        // The chat still works without persistence.
      }
    }
    // Attachments ride on the request body; the API analyses images and notes
    // the document links in the prompt.
    await (sendMessage as any)(
      {
        text: text || "Please review the attached file(s) and summarise what matters for this course.",
        // Kept on the message so the user can see which files went with it after
        // the composer's chips are cleared.
        metadata: {
          attachments: readyAttachments.map((a) => ({ name: a.name, url: a.url, type: a.type })),
        },
      },
      {
        body: {
          attachments: readyAttachments.map((a) => ({ url: a.url, type: a.type, name: a.name })),
          conversationId: activeConversationId ?? undefined,
        },
      },
    )

    setInput("")
    setAttachments([])
    setUploadError(null)

    void loadSessions().then((list) => {
      if (list.length > 0) setSessions(list)
    })
  }

  return (
    <Card className="mx-auto h-[calc(100vh-16rem)] max-w-4xl">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            AI Teaching Assistant
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={startNewChat} disabled={isBusy}>
              <Plus className="mr-1.5 h-4 w-4" />
              New chat
            </Button>
            <Popover open={historyOpen} onOpenChange={setHistoryOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" size="sm" aria-label="Chat history">
                  <History className="mr-1.5 h-4 w-4" />
                  History
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-2">
                <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Previous sessions
                </p>
                <div className="max-h-72 overflow-y-auto">
                  {isLoadingSessions ? (
                    <p className="px-2 py-6 text-center text-sm text-muted-foreground">Loading…</p>
                  ) : sessions.length === 0 ? (
                    <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                      No previous sessions for this course yet.
                    </p>
                  ) : (
                    sessions.map((session) => (
                      <button
                        key={session.id}
                        type="button"
                        onClick={() => void openSession(session)}
                        className={`flex w-full items-start gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted ${
                          session.id === conversationId ? "bg-muted" : ""
                        }`}
                      >
                        <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{session.title}</span>
                          <span className="block text-xs text-muted-foreground">
                            {new Date(session.updated_at).toLocaleString()}
                          </span>
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex h-[calc(100%-5rem)] flex-col">
        <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Bot className="mb-4 h-16 w-16 text-gray-500 dark:text-gray-400" />
                <h3 className="mb-2 text-lg font-semibold">Chat with your lecture slides</h3>
              </div>
            )}
            {messages.map((message) => (
              <div key={message.id} className={`flex gap-3 ${message.role === "user" ? "justify-end" : ""}`}>
                {message.role === "assistant" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
                    <Bot className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                    message.role === "user" ? "bg-blue-600 text-white" : "bg-muted text-foreground"
                  }`}
                >
                  {message.parts.map((part, index) => {
                    if (part.type === "text") {
                      // Assistant replies are Markdown; rendering them as plain
                      // text left literal ** markers from the model.
                      if (message.role === "assistant") {
                        return (
                          <div key={index} className="text-sm leading-relaxed">
                            <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
                              {part.text}
                            </ReactMarkdown>
                          </div>
                        )
                      }
                      return (
                        <p key={index} className="whitespace-pre-wrap text-sm leading-relaxed">
                          {part.text}
                        </p>
                      )
                    }
                    return null
                  })}
                  {(() => {
                    const attached = (message.metadata as any)?.attachments
                    if (!Array.isArray(attached) || attached.length === 0) return null
                    return (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {attached.map((file: { name?: string }, index: number) => (
                          <span
                            key={`${file?.name ?? "file"}-${index}`}
                            className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[11px]"
                          >
                            <Paperclip className="h-3 w-3" />
                            {file?.name ?? "attachment"}
                          </span>
                        ))}
                      </div>
                    )
                  })()}
                </div>
                {message.role === "user" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600">
                    <User className="h-4 w-4 text-white" />
                  </div>
                )}
              </div>
            ))}
            {isBusy && (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
                  <Bot className="h-4 w-4 animate-pulse text-blue-600 dark:text-blue-400" />
                </div>
                <div className="max-w-[80%] rounded-2xl bg-muted px-4 py-2">
                  <p className="text-sm text-gray-700 dark:text-gray-300">Thinking...</p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {attachments.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {attachments.map((attachment) => (
              <span
                key={attachment.id}
                className="inline-flex items-center gap-1.5 rounded-full border bg-muted px-2.5 py-1 text-xs"
              >
                {attachment.uploading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Paperclip className="h-3 w-3" />
                )}
                <span className="max-w-[180px] truncate">{attachment.name}</span>
                <button
                  type="button"
                  aria-label={`Remove ${attachment.name}`}
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() =>
                    setAttachments((previous) => previous.filter((item) => item.id !== attachment.id))
                  }
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {uploadError && <p className="mt-2 text-xs text-destructive">{uploadError}</p>}

        <form onSubmit={handleSubmit} className="mt-4 flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            accept="image/*,.pdf,.doc,.docx,.txt,.ppt,.pptx"
            onChange={(event) => {
              void uploadFiles(event.target.files)
              event.target.value = ""
            }}
          />
          <Button
            type="button"
            size="icon"
            variant="outline"
            aria-label="Attach files"
            title="Attach files"
            disabled={isBusy}
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="h-4 w-4" />
          </Button>

          <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label="Insert emoji"
                title="Insert emoji"
                disabled={isBusy}
              >
                <Smile className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-2">
              <div className="grid grid-cols-8 gap-1">
                {EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    aria-label={`Insert ${emoji}`}
                    className="rounded p-1 text-lg transition-colors hover:bg-muted"
                    onClick={() => {
                      setInput((previous) => previous + emoji)
                      setEmojiOpen(false)
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask about this course, or attach a file…"
            disabled={isBusy}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={isBusy || !canSend} aria-label="Send message">
            {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
