"use client"

import type React from "react"

import { cn } from "@/lib/utils"
import { useState, useRef, useEffect, useMemo } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import {
  ArrowLeft,
  ArrowUp,
  Mic,
  Paperclip,
  Search,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react"
import type { Profile, Course, CourseMaterial } from "@/lib/types"
import { Response } from "@/components/ai-elements/response"
import { Thinking } from "@/components/ai-elements/thinking"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getUserFacingChatError } from "@/lib/ai/chat-errors"
import { MODEL_CONFIGS, getModelConfig } from "@/lib/ai/models"
import { BrandIcon } from "@/components/brand-icon"

interface ChatInterfaceProps {
  profile: Profile
  courses: Course[]
  materials: CourseMaterial[]
  conversationId: string | null
  pdfRagEnabled?: boolean
  ragDocumentId?: string | null
  ragDocumentName?: string | null
}

const SUGGESTIONS = [
  "what is Expo in React Native?",
  "How to book MFU study room?",
  "Where is MFU gym inside university?",
  "Which documents do i need to apply MFU scholarship?",
]

export function ChatInterface({
  profile,
  courses,
  materials,
  conversationId,
  pdfRagEnabled = false,
  ragDocumentId = null,
  ragDocumentName = null,
}: ChatInterfaceProps) {
  const router = useRouter()
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [initialMessages, setInitialMessages] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(!!conversationId)
  const [isCreatingConversation, setIsCreatingConversation] = useState(false)
  const [activeConversationId, setActiveConversationId] = useState<string | null>(conversationId)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState<string>("default")
  const [inputValue, setInputValue] = useState<string>("")
  const [attachments, setAttachments] = useState<{ id: string; name: string; url: string; type: string }[]>([])
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [showTip, setShowTip] = useState(true)
  const isDemoProfile =
    profile.id.startsWith("mock-") || profile.email.trim().toLowerCase().startsWith("demo.")

  const [feedbackMap, setFeedbackMap] = useState<Record<string, "positive" | "negative">>({})

  const handleFeedback = async (messageId: string, rating: "positive" | "negative") => {
    setFeedbackMap((prev) => ({ ...prev, [messageId]: rating }))
    try {
      await fetch("/api/chat/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, rating }),
      })
    } catch (error) {
      console.error("Failed to save feedback:", error)
      setFeedbackMap((prev) => {
        const next = { ...prev }
        delete next[messageId]
        return next
      })
    }
  }

  const models = MODEL_CONFIGS.filter((m) => m.enabled !== false).map((m) => ({ id: m.id, label: m.label }))

  useEffect(() => {
    setActiveConversationId(conversationId)
    if (conversationId) {
      fetch(`/api/conversations/${conversationId}`)
        .then(async (res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
          return res.json()
        })
        .then((data) => {
          if (data.messages && Array.isArray(data.messages)) {
            setInitialMessages(
              data.messages.map((msg: any) => ({
                id: msg.id,
                role: msg.role,
                parts: [{ type: "text", text: msg.content }],
              })),
            )
          } else {
            setInitialMessages([])
          }
          setIsLoading(false)
        })
        .catch((error) => {
          console.error("Error loading conversation:", error)
          setLoadError(error instanceof Error ? error.message : "Failed to load conversation")
          setInitialMessages([])
          setIsLoading(false)
        })
    } else {
      setInitialMessages([])
      setIsLoading(false)
    }
  }, [conversationId])

  const chatKeyRef = useRef(`chat-${conversationId ?? "new"}`)
  const modelConfig = useMemo(() => getModelConfig(selectedModel), [selectedModel])

  const chatBody = useMemo(
    () => ({
      conversationId: activeConversationId,
      model: selectedModel,
      systemPromptOverride: modelConfig.systemPrompt,
      attachments: attachments.map((a) => ({ url: a.url, type: a.type })),
      pdfRagEnabled,
      ragDocumentId,
      ragDocumentName,
    }),
    [activeConversationId, selectedModel, modelConfig.systemPrompt, attachments, pdfRagEnabled, ragDocumentId, ragDocumentName],
  )
  const chatBodyRef = useRef(chatBody)
  chatBodyRef.current = chatBody
  const chatTransport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => chatBodyRef.current,
      }),
    [],
  )

  const { messages, sendMessage, regenerate, status, error: chatError, clearError, setMessages } = useChat({
    id: chatKeyRef.current,
    transport: chatTransport,
    onError: (error) => console.error("Chat response failed:", error),
  })
  const isChatBusy = status === "submitted" || status === "streaming"

  const latestMessagesRef = useRef<any[]>([])
  useEffect(() => {
    latestMessagesRef.current = messages as any[]
  }, [messages])

  const syncDemoConversation = async (conversationIdToSync: string, sourceMessages: any[]) => {
    if (!isDemoProfile || !conversationIdToSync) return

    const simplifiedMessages = sourceMessages
      .map((message: any) => {
        const role = message?.role === "assistant" ? "assistant" : message?.role === "user" ? "user" : null
        if (!role) return null
        const content = Array.isArray(message?.parts)
          ? message.parts
              .filter((part: any) => part?.type === "text" && typeof part?.text === "string")
              .map((part: any) => part.text)
              .join("\n")
              .trim()
          : ""
        if (!content) return null
        return { id: typeof message?.id === "string" ? message.id : undefined, role, content }
      })
      .filter(Boolean)

    try {
      await fetch(`/api/conversations/${conversationIdToSync}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: simplifiedMessages.find((message: any) => message.role === "user")?.content?.slice(0, 50) || "New Conversation",
          messages: simplifiedMessages,
        }),
      })
    } catch (error) {
      console.error("Error syncing demo conversation:", error)
    }
  }

  useEffect(() => {
    if (initialMessages.length > 0 && messages.length === 0) {
      setMessages(initialMessages)
    }
  }, [initialMessages, messages.length, setMessages])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  useEffect(() => {
    const current = MODEL_CONFIGS.find((m) => m.id === selectedModel)
    if (current?.enabled === false) {
      const enabledModel = MODEL_CONFIGS.find((m) => m.enabled !== false) || MODEL_CONFIGS[0]
      setSelectedModel(enabledModel.id)
    }
  }, [selectedModel])

  // composer auto-grow
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`
  }, [inputValue])

  const fileToDataURL = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

  const canSend = (inputValue.trim().length > 0 || pendingFiles.length > 0) && !isCreatingConversation

  const handleSubmit = async () => {
    if (!canSend) return
    const text = inputValue.trim()
    let conversationIdForRequest = activeConversationId
    let shouldNavigateAfterSend = false
    const canPersistConversation = !!profile.id && (!profile.id.startsWith("mock-") || isDemoProfile)

    if (!conversationIdForRequest && canPersistConversation) {
      try {
        setIsCreatingConversation(true)
        const response = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: text.slice(0, 50) || "New Conversation" }),
        })

        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`)

        const data = await response.json()
        conversationIdForRequest = data?.conversation?.id ?? null

        if (!conversationIdForRequest) throw new Error("Missing conversation id in create response")

        setActiveConversationId(conversationIdForRequest)
        shouldNavigateAfterSend = true
      } catch (error) {
        console.error("Error creating conversation:", error)
        setLoadError(error instanceof Error ? error.message : "Failed to create conversation")
        return
      } finally {
        setIsCreatingConversation(false)
      }
    }

    const fileParts = await Promise.all(
      pendingFiles.map(async (f) => ({
        type: "file" as const,
        mediaType: f.type,
        url: await fileToDataURL(f),
      })),
    )

    await (sendMessage as any)(
      { parts: [...(text ? [{ type: "text" as const, text }] : []), ...fileParts] },
      { body: { conversationId: conversationIdForRequest, studentId: profile.id } },
    )

    if (conversationIdForRequest && isDemoProfile) {
      await syncDemoConversation(conversationIdForRequest, latestMessagesRef.current)
    }

    if (shouldNavigateAfterSend && conversationIdForRequest) {
      const params = new URLSearchParams()
      if (pdfRagEnabled) params.set("pdfRag", "1")
      if (ragDocumentId) params.set("docId", ragDocumentId)
      if (ragDocumentName) params.set("docName", ragDocumentName)
      const suffix = params.toString() ? `?${params.toString()}` : ""
      window.history.replaceState(null, "", `/chat/${conversationIdForRequest}${suffix}`)
    }

    setInputValue("")
    setPendingFiles([])
    setAttachments([])
  }

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setIsUploading(true)
    setPendingFiles((prev) => [...prev, ...Array.from(files)])
    const selected = Array.from(files).map((f, idx) => ({
      id: `${Date.now()}-${idx}-${f.name}`,
      name: f.name,
      url: URL.createObjectURL(f),
      type: f.type,
    }))
    setAttachments((prev) => [...prev, ...selected])

    const form = new FormData()
    Array.from(files).forEach((f) => form.append("files", f))
    try {
      const res = await fetch("/api/uploads", { method: "POST", body: form })
      if (!res.ok) return
      const { files: uploaded } = await res.json()
      setAttachments((prev) =>
        prev.map((att) => {
          const match = uploaded.find((u: any) => u.name === att.name)
          return match ? { ...att, url: match.url, type: match.type || att.type } : att
        }),
      )
    } catch {
    } finally {
      setIsUploading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleRetry = async () => {
    clearError()
    await regenerate({
      body: {
        conversationId: activeConversationId,
        studentId: profile.id,
      },
    })
  }

  const isEmpty = !isLoading && !loadError && messages.length === 0

  return (
    <div className="mf-main">
      {conversationId && (
        <div style={{ flex: "0 0 auto", padding: "10px 16px 0" }}>
          <div className="mf-column">
            <button
              type="button"
              onClick={() => router.push("/chat")}
              className="mf-chip"
              style={{ height: 34, fontSize: 13 }}
            >
              <ArrowLeft size={15} />
              Back to AI Chat
            </button>
          </div>
        </div>
      )}

      {/* Chat Messages */}
      <div className="mf-scroll" ref={scrollRef}>
        <div className="mf-column">
          {isLoading && (
            <div className="mf-loading">
              <span className="mf-spinner" />
              Loading conversation…
            </div>
          )}

          {loadError && (
            <div className="mf-notice" data-tone="error" style={{ marginTop: 24 }}>
              <p style={{ margin: 0 }}>Failed to load conversation. {loadError}</p>
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
                size="sm"
                className="mt-3 text-sm"
              >
                Try Again
              </Button>
            </div>
          )}

          {isEmpty && (
            <div className="mf-hero">
              <div className="mf-hero-mark">
                <BrandIcon size={44} tone="light" />
              </div>
              <h1 className="mf-headline">
                When you need certainty,
                <br />
                ask the assistant that knows MFU.
              </h1>
              <p className="mf-sub">Hi there! I am your AI teaching assistant.</p>

              <div className="mf-chips">
                {SUGGESTIONS.map((prompt) => (
                  <button key={prompt} type="button" className="mf-chip" onClick={() => setInputValue(prompt)}>
                    <MessageGlyph />
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.length > 0 && (
            <div className="mf-messages">
              {messages.map((message: any) => {
                const textParts = (message.parts || []).filter((part: any) => part.type === "text")
                if (message.role === "assistant") {
                  return (
                    <div key={message.id} className="mf-msg">
                      <div className="mf-ai-avatar">
                        <BrandIcon size={16} tone="light" />
                      </div>
                      <div className="mf-ai-body">
                        {textParts.map((part: any, i: number) => (
                          <Response key={`${message.id}-${i}`} enableMarkdown={true}>
                            {part.text}
                          </Response>
                        ))}
                        {!isChatBusy && (
                          <div className="mf-actions">
                            <button
                              type="button"
                              className="mf-action"
                              data-on={feedbackMap[message.id] === "positive" ? "positive" : undefined}
                              onClick={() => handleFeedback(message.id, "positive")}
                              title="Good response"
                            >
                              <ThumbsUp size={15} />
                            </button>
                            <button
                              type="button"
                              className="mf-action"
                              data-on={feedbackMap[message.id] === "negative" ? "negative" : undefined}
                              onClick={() => handleFeedback(message.id, "negative")}
                              title="Bad response"
                            >
                              <ThumbsDown size={15} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                }
                return (
                  <div key={message.id} className="mf-msg mf-msg-user">
                    <div className="mf-bubble">
                      {textParts.map((part: any, i: number) => (
                        <Response key={`${message.id}-${i}`} enableMarkdown={false}>
                          {part.text}
                        </Response>
                      ))}
                    </div>
                  </div>
                )
              })}

              {isChatBusy && (
                <div className="mf-msg">
                  <div className="mf-ai-avatar">
                    <BrandIcon size={16} tone="light" />
                  </div>
                  <div className="mf-ai-body">
                    <Thinking />
                  </div>
                </div>
              )}

              {chatError && (
                <div className="mf-notice" data-tone="error">
                  <p style={{ margin: 0 }}>{getUserFacingChatError(chatError)}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => void handleRetry()}
                    disabled={isChatBusy}
                  >
                    Try again
                  </Button>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Composer */}
      <div className="mf-composer-wrap">
        <div className="mf-column">
          {pdfRagEnabled && (
            <div className="mf-rag-banner">
              <Search size={13} />
              <span>
                Document RAG on{ragDocumentName ? <> for <b>{ragDocumentName}</b></> : null}
              </span>
            </div>
          )}

          {messages.length === 0 && showTip && (
            <div className="mf-tip">
              <span>
                Attach a course PDF and I&apos;ll answer from it.
              </span>
              <button type="button" className="mf-tip-x" onClick={() => setShowTip(false)} aria-label="Dismiss tip">
                <X size={14} />
              </button>
            </div>
          )}

          <div className="mf-composer">
            {attachments.length > 0 && (
              <div className="mf-files">
                {attachments.map((att) => (
                  <span key={att.id} className="mf-file">
                    <Paperclip size={13} />
                    <span style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {att.name}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${att.name}`}
                      onClick={() => {
                        setAttachments((prev) => prev.filter((a) => a.id !== att.id))
                        setPendingFiles((prev) => prev.filter((f) => f.name !== att.name))
                      }}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <textarea
              ref={textareaRef}
              rows={1}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about your courses…"
              disabled={isChatBusy || isLoading || isCreatingConversation}
            />

            <div className="mf-toolbar">
              <div className="mf-toolwrap">
                <label className="mf-iconbtn" style={{ position: "relative", cursor: "pointer" }} title="Attach files">
                  <Paperclip size={18} />
                  <input
                    type="file"
                    multiple
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    style={{ position: "absolute", inset: 0, opacity: 0 }}
                    onChange={(e) => handleUpload(e.currentTarget.files)}
                  />
                </label>
                <button type="button" className="mf-iconbtn" title="Voice input">
                  <Mic size={18} />
                </button>

                <Select
                  value={selectedModel}
                  onValueChange={(val) => {
                    if (MODEL_CONFIGS.find((m) => m.id === val)?.enabled === false) return
                    setSelectedModel(val)
                  }}
                >
                  <SelectTrigger className="mf-modelpill">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <button
                type="button"
                className="mf-sendbtn"
                onClick={handleSubmit}
                disabled={
                  isChatBusy || isLoading || isUploading || isCreatingConversation || (!inputValue.trim() && pendingFiles.length === 0)
                }
                aria-label="Send message"
              >
                <ArrowUp size={18} />
              </button>
            </div>
          </div>

          <div className="mf-terms">
            MFU AI can make mistakes — verify important information.
          </div>
        </div>
      </div>
    </div>
  )
}

function MessageGlyph() {
  return <Sparkles size={15} />
}
