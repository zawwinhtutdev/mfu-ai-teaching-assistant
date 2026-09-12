"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import ReactMarkdown from "react-markdown"

interface ResponseProps extends React.HTMLAttributes<HTMLDivElement> {
  children: string
  enableMarkdown?: boolean
}

export function Response({ children, enableMarkdown = true, className, ...props }: ResponseProps) {
  if (!enableMarkdown) {
    return (
      <div className={cn("whitespace-pre-wrap text-sm leading-relaxed", className)} {...props}>
        {children}
      </div>
    )
  }

  return (
    <div className={cn("prose prose-sm dark:prose-invert max-w-none", className)} {...props}>
      <ReactMarkdown
        components={{
          code({ className, children, ...props }) {
            const inline = !/language-(\w+)/.test(className || "")
            const match = /language-(\w+)/.exec(className || "")
            return !inline && match ? (
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto my-4">
                <code className={cn("text-sm", className)} {...props}>
                  {String(children).replace(/\n$/, "")}
                </code>
              </pre>
            ) : (
              <code className={cn("rounded bg-muted px-1 py-0.5 text-sm", className)} {...props}>
                {children}
              </code>
            )
          },
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="my-2 ml-4 list-disc">{children}</ul>,
          ol: ({ children }) => <ol className="my-2 ml-4 list-decimal">{children}</ol>,
          li: ({ children }) => <li className="mb-1">{children}</li>,
          h1: ({ children }) => <h1 className="mb-2 text-xl font-bold">{children}</h1>,
          h2: ({ children }) => <h2 className="mb-2 text-lg font-bold">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-1 text-base font-bold">{children}</h3>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-gray-300 pl-4 italic dark:border-gray-700">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a href={href} className="text-blue-600 underline hover:text-blue-700 dark:text-blue-400" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
