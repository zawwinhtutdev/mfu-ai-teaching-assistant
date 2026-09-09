"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Bot } from "lucide-react"

interface ThinkingProps extends React.HTMLAttributes<HTMLDivElement> {
  message?: string
}

export function Thinking({ message = "Thinking...", className, ...props }: ThinkingProps) {
  return (
    <div className={cn("flex gap-4", className)} {...props}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-red-500 to-red-600">
        <Bot className="h-5 w-5 animate-pulse text-white" />
      </div>
      <div className="max-w-[85%] rounded-2xl bg-card px-5 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-700 dark:text-gray-300">{message}</span>
          <div className="flex gap-1">
            <div className="h-2 w-2 animate-bounce rounded-full bg-blue-500 [animation-delay:-0.3s]"></div>
            <div className="h-2 w-2 animate-bounce rounded-full bg-blue-500 [animation-delay:-0.15s]"></div>
            <div className="h-2 w-2 animate-bounce rounded-full bg-blue-500"></div>
          </div>
        </div>
      </div>
    </div>
  )
}

