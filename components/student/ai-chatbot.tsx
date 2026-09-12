"use client"

import type React from "react"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send, Bot, User } from "lucide-react"
import type { CourseMaterial, ChatbotSettings } from "@/lib/types"
import { useEffect, useRef } from "react"

interface AIChatbotProps {
  courseId: string
  studentId: string
  materials: CourseMaterial[]
  chatbotSettings: ChatbotSettings | null
}

export function AIChatbot({ courseId, studentId, materials, chatbotSettings }: AIChatbotProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: {
        courseId,
        studentId,
        materials: materials.map((m) => ({ id: m.id, title: m.title, content: m.content })),
        tone: chatbotSettings?.tone || "professional",
        model: chatbotSettings?.ai_model || "google/gemini-3.8-flash",
      },
    }),
  })

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const input = (e.target as any).message.value
    if (input.trim()) {
      sendMessage({ text: input })
      ;(e.target as any).message.value = ""
    }
  }
  const isBusy = status === "streaming" || status === "submitted"

  return (
    <Card className="mx-auto h-[calc(100vh-16rem)] max-w-4xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          AI Teaching Assistant
        </CardTitle>
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
                      return (
                        <p key={index} className="whitespace-pre-wrap text-sm leading-relaxed">
                          {part.text}
                        </p>
                      )
                    }
                    return null
                  })}
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

        <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
          <Input
            name="message"
            placeholder=""
            disabled={isBusy}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={isBusy}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
