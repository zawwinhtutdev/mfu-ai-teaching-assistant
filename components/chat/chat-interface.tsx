"use client"

import type React from "react"

import { cn } from "@/lib/utils"
import { useState, useRef, useEffect, useMemo } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { Send, Bot, Sparkles, Plus, Mic, Paperclip, ArrowLeft, ThumbsUp, ThumbsDown } from "lucide-react"
import type { Profile, Course, CourseMaterial } from "@/lib/types"
import { Message, MessageContent } from "@/components/ai-elements/message"
import { Response } from "@/components/ai-elements/response"
import { Thinking } from "@/components/ai-elements/thinking"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { AnimateButton } from "@/components/animate-ui"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AdvancedChatInput } from "@/components/ui/advanced-chat-input"
import { getUserFacingChatError } from "@/lib/ai/chat-errors"
import { MODEL_CONFIGS, getModelConfig } from "@/lib/ai/models"

interface ChatInterfaceProps {
  profile: Profile
  courses: Course[]
  materials: CourseMaterial[]
  conversationId: string | null
  pdfRagEnabled?: boolean
  ragDocumentId?: string | null
  ragDocumentName?: string | null
}

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
  const [initialMessages, setInitialMessages] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(!!conversationId)
  const [isCreatingConversation, setIsCreatingConversation] = useState(false)
  const [activeConversationId, setActiveConversationId] = useState<string | null>(conversationId)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState<string>("default")
  const [inputValue, setInputValue] = useState<string>("")
  const [attachments, setAttachments] = useState<{ id: string, name: string, url: string, type: string }[]>([])
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const isDemoProfile =
    profile.id.startsWith("mock-") ||
    profile.email.trim().toLowerCase().startsWith("demo.")

  // Chat feedback (thumbs up/down) state
  const [feedbackMap, setFeedbackMap] = useState<Record<string, "positive" | "negative">>({})

  const handleFeedback = async (messageId: string, rating: "positive" | "negative") => {
    // Optimistic update
    setFeedbackMap((prev) => ({ ...prev, [messageId]: rating }))
    try {
      await fetch("/api/chat/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, rating }),
      })
    } catch (error) {
      console.error("Failed to save feedback:", error)
      // Revert on error
      setFeedbackMap((prev) => {
        const next = { ...prev }
        delete next[messageId]
        return next
      })
    }
  }

  // MFU Guide preset prompt for everyone (strengthened for depth and structure)
  const mfuGuidePrompt = `
You are MFU Guide for everyone (students, staff, applicants, visitors, alumni). Always identify yourself as "MFU Guide", not as an AI teaching assistant.
If the user asks "who are you" or similar, clearly answer: "I'm MFU Guide for Mae Fah Luang University. I help with any MFU-related questions."

Your goal is to provide thorough, practical, and well-structured answers about Mae Fah Luang University (MFU).

When answering:
- Start with a 1–2 sentence direct answer.
- Then add detailed sections with clear subheadings (e.g., "Faculties & Majors", "How to Apply", "Contacts & Office Hours").
- Use bullet lists for options, steps, locations, requirements, and contacts.
- Include typical ranges/estimates and common exceptions when relevant.
- Provide official verification paths (website section, office, phone/email) when data may change.
- End with a short follow-up question that offers next steps.

Tone & style:
- Clear, student/visitor-friendly, and actionable first; add depth afterward.
- Avoid speculation; say how to verify when uncertain.

Output length:
- Aim for 150–300 words for general questions; up to 500 words for complex topics.
`

  // Available AI models (from central config) - only enabled ones
  const models = MODEL_CONFIGS.filter(m => m.enabled !== false).map((m) => ({ id: m.id, label: m.label }))

  // Debug: Log component props
  console.log("🔍 ChatInterface props:", { conversationId, profile: profile?.id, courses: courses?.length, materials: materials?.length })
  console.log("v0 ChatInterface loaded with conversationId:", conversationId)
  console.log("v0 Component mounted at:", new Date().toISOString())

  useEffect(() => {
    setActiveConversationId(conversationId)
    console.log("🚀 useEffect triggered with conversationId:", conversationId)
    console.log("v0 useEffect triggered with conversationId:", conversationId)
    if (conversationId) {
      console.log("📡 Fetching conversation:", conversationId)
      console.log("v0 Fetching conversation:", conversationId)
      fetch(`/api/conversations/${conversationId}`)
        .then(async (res) => {
          console.log("📥 API response status:", res.status)
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`)
          }
          return res.json()
        })
        .then((data) => {
          console.log("✅ Conversation data received:", data)
          console.log("v0 Conversation data received:", data)
          console.log("📊 Messages array:", data.messages)
          console.log("v0 Messages array:", data.messages)
          console.log("📊 Messages length:", data.messages?.length)
          console.log("v0 Messages length:", data.messages?.length)
          if (data.messages && Array.isArray(data.messages)) {
            const formattedMessages: any[] = data.messages.map((msg: any) => ({
              id: msg.id,
              role: msg.role,
              parts: [{ type: "text", text: msg.content }],
            }))
            console.log("🔄 Formatted messages:", formattedMessages)
            console.log("v0 Formatted messages:", formattedMessages)
            setInitialMessages(formattedMessages)
          } else {
            console.log("❌ No messages found in conversation")
            console.log("v0 No messages found in conversation")
            setInitialMessages([])
          }
          setIsLoading(false)
        })
        .catch((error) => {
          console.error("💥 Error loading conversation:", error)
          console.log("v0 Error loading conversation:", error)
          setLoadError(error instanceof Error ? error.message : "Failed to load conversation")
          setInitialMessages([])
          setIsLoading(false)
        })
    } else {
      console.log("🆕 No conversation ID, starting new conversation")
      console.log("v0 No conversation ID, starting new conversation")
      setInitialMessages([])
      setIsLoading(false)
    }
  }, [conversationId])

  // Keep one chat instance for this mounted page. Re-keying while a response is in
  // flight discards the stream when a newly created conversation receives its id.
  const chatKeyRef = useRef(`chat-${conversationId ?? "new"}`)
  const modelConfig = useMemo(() => getModelConfig(selectedModel), [selectedModel])
  
  // Memoize body to ensure it updates when model or attachments change
  const chatBody = useMemo(() => ({
    conversationId: activeConversationId,
    model: selectedModel,
    systemPromptOverride: modelConfig.systemPrompt,
    attachments: attachments.map(a => ({ url: a.url, type: a.type })),
    pdfRagEnabled,
    ragDocumentId,
    ragDocumentName,
  }), [activeConversationId, selectedModel, modelConfig.systemPrompt, attachments, pdfRagEnabled, ragDocumentId, ragDocumentName])
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

  const {
    messages,
    sendMessage,
    regenerate,
    status,
    error: chatError,
    clearError,
    setMessages,
  } = useChat({
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

        return {
          id: typeof message?.id === "string" ? message.id : undefined,
          role,
          content,
        }
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
      console.error("💥 Error syncing demo conversation:", error)
    }
  }

  

  // Update messages when initialMessages change
  useEffect(() => {
    if (initialMessages.length > 0 && messages.length === 0) {
      console.log("v0 Setting messages from initialMessages:", initialMessages)
      setMessages(initialMessages)
    }
  }, [initialMessages, messages.length, setMessages])

  // Debug: Log messages state
  console.log("v0 useChat messages:", messages)
  console.log("v0 useChat messages length:", messages.length)
  console.log("v0 useChat status:", status)
  console.log("v0 initialMessages:", initialMessages)
  console.log("v0 initialMessages length:", initialMessages.length)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Ensure selected model is enabled, reset to default if disabled
  useEffect(() => {
    const modelConfig = MODEL_CONFIGS.find(m => m.id === selectedModel)
    if (modelConfig?.enabled === false) {
      // Find first enabled model or default
      const enabledModel = MODEL_CONFIGS.find(m => m.enabled !== false) || MODEL_CONFIGS[0]
      setSelectedModel(enabledModel.id)
    }
  }, [selectedModel])

  const fileToDataURL = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

  const handleSubmit = async () => {
    if ((inputValue.trim() || pendingFiles.length > 0) && !isCreatingConversation) {
      console.log("🚀🚀🚀 SENDING MESSAGE:", inputValue)
      console.log("🚀🚀🚀 CONVERSATION ID:", activeConversationId)
      console.log("🚀🚀🚀 PROFILE ID:", profile.id)
      console.log("🚀🚀🚀 SELECTED MODEL:", selectedModel)
      const text = inputValue.trim()
      let conversationIdForRequest = activeConversationId
      let shouldNavigateAfterSend = false
      const canPersistConversation = !!profile.id && (!profile.id.startsWith("mock-") || isDemoProfile)

      // Ensure a single conversation is reused for this chat thread.
      if (!conversationIdForRequest && canPersistConversation) {
        try {
          setIsCreatingConversation(true)
          const response = await fetch("/api/conversations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: text.slice(0, 50) || "New Conversation" }),
          })

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }

          const data = await response.json()
          conversationIdForRequest = data?.conversation?.id ?? null

          if (!conversationIdForRequest) {
            throw new Error("Missing conversation id in create response")
          }

          setActiveConversationId(conversationIdForRequest)
          shouldNavigateAfterSend = true
        } catch (error) {
          console.error("💥 Error creating conversation:", error)
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
        }))
      )

      await sendMessage({
        parts: [
          ...(text ? [{ type: "text" as const, text }] : []),
          ...fileParts,
        ],
      }, {
        body: {
          conversationId: conversationIdForRequest,
          studentId: profile.id,
        },
      })

      if (conversationIdForRequest && isDemoProfile) {
        await syncDemoConversation(conversationIdForRequest, latestMessagesRef.current)
      }

      if (shouldNavigateAfterSend && conversationIdForRequest) {
        const params = new URLSearchParams()
        if (pdfRagEnabled) params.set("pdfRag", "1")
        if (ragDocumentId) params.set("docId", ragDocumentId)
        if (ragDocumentName) params.set("docName", ragDocumentName)
        const suffix = params.toString() ? `?${params.toString()}` : ""
        // Use replaceState to update URL without re-rendering (preserves in-flight AI response)
        window.history.replaceState(null, "", `/chat/${conversationIdForRequest}${suffix}`)
      }

      setInputValue("")
      setPendingFiles([])
    }
  }
  const onFileRemove = (id: string) => {
    setAttachments((prev) => prev.filter((f) => f.id !== id))
  }

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setIsUploading(true)
    // Collect for immediate vision send
    setPendingFiles((prev) => [...prev, ...Array.from(files)])
    // Optimistically show selected files using local object URLs
    const selected = Array.from(files).map((f, idx) => ({ id: `${Date.now()}-${idx}-${f.name}` , name: f.name, url: URL.createObjectURL(f), type: f.type }))
    setAttachments((prev) => ([...prev, ...selected]))

    const form = new FormData()
    Array.from(files).forEach((f) => form.append("files", f))
    try {
      const res = await fetch("/api/uploads", { method: "POST", body: form })
      if (!res.ok) return
      const { files: uploaded } = await res.json()
      // Replace local URLs with uploaded URLs by name match
      setAttachments((prev) => prev.map((att) => {
        const match = uploaded.find((u: any) => u.name === att.name)
        return match ? { ...att, url: match.url, type: match.type || att.type } : att
      }))
    } catch {}
    finally { setIsUploading(false) }
  }


  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
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

  return (
    <div className="relative flex h-full flex-col bg-linear-to-br from-blue-50/50 via-white to-indigo-50/50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950/50">

      {/* Back Button Header - Only show when viewing a conversation */}
      {conversationId && (
        <div className="border-b bg-card/50 backdrop-blur-sm px-4 sm:px-6 py-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/chat')}
            className="gap-2"
            data-slot="button"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to AI Chat
          </Button>
        </div>
      )}

      {/* Chat Messages */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full px-4 sm:px-6" ref={scrollRef}>
          <div className="mx-auto max-w-3xl space-y-4 sm:space-y-6 py-4 sm:py-8">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12 sm:py-20 text-center">
              <div className="mb-4 sm:mb-6 flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-linear-to-br from-red-500 to-red-600">
                <Bot className="h-8 w-8 sm:h-10 sm:w-10 text-white animate-pulse" />
              </div>
              <h2 className="mb-3 text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
                Loading conversation...
              </h2>
              <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300">
                Please wait while we load your previous messages
              </p>
            </div>
          )}
          {loadError && (
            <div className="flex flex-col items-center justify-center py-12 sm:py-20 text-center">
              <div className="mb-4 sm:mb-6 flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
                <Bot className="h-8 w-8 sm:h-10 sm:w-10 text-red-600 dark:text-red-400" />
              </div>
              <h2 className="mb-3 text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
                Failed to load conversation
              </h2>
              <p className="text-sm sm:text-base text-red-600 dark:text-red-400 mb-4">
                {loadError}
              </p>
              <Button 
                onClick={() => window.location.reload()} 
                variant="outline"
                className="text-sm"
              >
                Try Again
              </Button>
            </div>
          )}
          {!isLoading && !loadError && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 sm:py-20 text-center">
              <div className="mb-4 sm:mb-6 flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-linear-to-br from-red-500 to-red-600">
                <Bot className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
              </div>
              {/* Title removed per request */}
              <p className="mb-6 sm:mb-8 max-w-md text-balance text-sm sm:text-base text-gray-700 dark:text-gray-300">
                Hi there! I am ai teaching assistant.
              </p>
              <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-2 w-full max-w-md">
                <Button
                  variant="outline"
                  className="justify-start text-left bg-transparent hover:bg-blue-50 dark:hover:bg-blue-950/20 h-auto min-h-[44px] p-3 w-full"
                  onClick={() => setInputValue("what is Expo in React Native?")}
                >
                  <span className="text-sm leading-tight text-wrap overflow-hidden">what is Expo in React Native?</span>
                </Button>
                <Button
                  variant="outline"
                  className="justify-start text-left bg-transparent hover:bg-blue-50 dark:hover:bg-blue-950/20 h-auto min-h-[44px] p-3 w-full"
                  onClick={() => setInputValue("How to book MFU study room?")}
                >
                  <span className="text-sm leading-tight text-wrap overflow-hidden">How to book MFU study room?</span>
                </Button>
                <Button
                  variant="outline"
                  className="justify-start text-left bg-transparent hover:bg-blue-50 dark:hover:bg-blue-950/20 h-auto min-h-[44px] p-3 w-full"
                  onClick={() => setInputValue("Where is MFU gym inside university?")}
                >
                  <span className="text-sm leading-tight text-wrap overflow-hidden">Where is MFU gym inside university?</span>
                </Button>
                <Button
                  variant="outline"
                  className="justify-start text-left bg-transparent hover:bg-blue-50 dark:hover:bg-blue-950/20 h-auto min-h-[44px] p-3 w-full"
                  onClick={() => setInputValue("Which documents do i need to apply MFU scholarship?")}
                >
                  <span className="text-sm leading-tight text-wrap overflow-hidden">Which documents do i need to apply MFU scholarship?</span>
                </Button>
              </div>
            </div>
          )}
          {messages.map((message) => {
            console.log("v0 Rendering message:", message.id, message.role, message.parts)
            return (
              <Message key={message.id} from={message.role as "user" | "assistant"}>
                {message.role === "assistant" ? (
                  <div className="flex flex-col max-w-[85%]">
                    <MessageContent from="assistant">
                      {message.parts
                        .filter((part) => part.type === "text")
                        .map((part, i) => (
                          <Response key={`${message.id}-${i}`} enableMarkdown={true}>
                            {part.text}
                          </Response>
                        ))}
                    </MessageContent>
                    {!isChatBusy && (
                      <div 
                        className="flex items-center gap-0.5 mt-1.5 pl-1 opacity-0 transition-opacity duration-200"
                        style={{ opacity: feedbackMap[message.id] ? 1 : undefined }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                        onMouseLeave={(e) => { if (!feedbackMap[message.id]) e.currentTarget.style.opacity = '0' }}
                      >
                        <button
                          onClick={() => handleFeedback(message.id, "positive")}
                          className={cn(
                            "p-1.5 rounded-lg transition-all duration-150",
                            feedbackMap[message.id] === "positive"
                              ? "text-green-600 dark:text-green-400"
                              : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                          )}
                          title="Good response"
                        >
                          <ThumbsUp className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleFeedback(message.id, "negative")}
                          className={cn(
                            "p-1.5 rounded-lg transition-all duration-150",
                            feedbackMap[message.id] === "negative"
                              ? "text-red-500 dark:text-red-400"
                              : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                          )}
                          title="Bad response"
                        >
                          <ThumbsDown className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <MessageContent from="user">
                    {message.parts
                      .filter((part) => part.type === "text")
                      .map((part, i) => (
                        <Response key={`${message.id}-${i}`} enableMarkdown={false}>
                          {part.text}
                        </Response>
                      ))}
                  </MessageContent>
                )}
              </Message>
            )
          })}
          {isChatBusy && <Thinking />}
          {chatError && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
            >
              <p>{getUserFacingChatError(chatError)}</p>
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
        </ScrollArea>
      </div>

      {/* Advanced Chat Input */}
      <div className="border-t bg-card/50 p-4 sm:p-6 backdrop-blur-sm">
        <div className="mx-auto max-w-3xl">
          {pdfRagEnabled && (
            <div className="mb-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
              Document RAG mode is on{ragDocumentName ? ` for "${ragDocumentName}"` : ""}. This mode uses uploaded document context.
            </div>
          )}
          {/* Advanced Chat Input */}
          <AdvancedChatInput
            textareaProps={{
              value: inputValue,
              onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setInputValue(e.target.value),
              onKeyDown: handleKeyDown,
              placeholder: "Ask a question about your courses...",
              disabled: isChatBusy || isLoading || isCreatingConversation,
            }}
            sendButtonProps={{
              disabled:
                isChatBusy ||
                isLoading ||
                isUploading ||
                isCreatingConversation ||
                (!inputValue.trim() && pendingFiles.length === 0),
            }}
            onSend={handleSubmit}
            files={pendingFiles.map((f, i) => ({ id: i, name: f.name, icon: <Paperclip className="h-4 w-4" /> }))}
            onFileRemove={(id) => setPendingFiles((prev) => prev.filter((_, i) => i !== (id as number)))}
            actionIcons={[
              <div key="plus" className="relative inline-flex">
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8">
                  <Plus size={16} />
                </Button>
                <input
                  type="file"
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  multiple
                  onChange={(e) => handleUpload(e.currentTarget.files)}
                />
              </div>,
              <Button key="mic" variant="ghost" size="icon" className="h-8 w-8">
                <Mic size={16} />
              </Button>,
              <Select key="model" value={selectedModel} onValueChange={(val) => { 
                // Prevent selecting disabled models
                const modelConfig = MODEL_CONFIGS.find(m => m.id === val)
                if (modelConfig?.enabled === false) return
                setSelectedModel(val) 
              }}>
                <SelectTrigger className="h-8 w-auto border-none bg-transparent font-medium text-muted-foreground shadow-none transition-colors hover:bg-accent hover:text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {models.map((model) => {
                    return (
                      <SelectItem 
                        key={model.id} 
                        value={model.id}
                      >
                        {model.label}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>,
            ]}
          />
        </div>
      </div>

    </div>
  )
}
