"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Bot, User } from "lucide-react"

interface MessageProps extends React.HTMLAttributes<HTMLDivElement> {
  from: "user" | "assistant" | "system"
  children: React.ReactNode
}

export function Message({ from, children, className, ...props }: MessageProps) {
  return (
    <div
      className={cn(
        "flex gap-4",
        from === "user" && "justify-end",
        className
      )}
      {...props}
    >
      {from === "assistant" && (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-red-500 to-red-600">
          <Bot className="h-5 w-5 text-white" />
        </div>
      )}
      {children}
      {from === "user" && (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-gray-700 to-gray-900 dark:from-gray-600 dark:to-gray-800">
          <User className="h-5 w-5 text-white" />
        </div>
      )}
    </div>
  )
}

interface MessageContentProps extends React.HTMLAttributes<HTMLDivElement> {
  from?: "user" | "assistant" | "system"
  children: React.ReactNode
}

export function MessageContent({ from = "assistant", children, className, ...props }: MessageContentProps) {
  return (
    <div
      className={cn(
        "max-w-[85%] rounded-2xl px-5 py-3",
        from === "user"
          ? "bg-linear-to-br from-blue-600 to-indigo-600 text-white shadow-md"
          : "bg-card shadow-sm",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

