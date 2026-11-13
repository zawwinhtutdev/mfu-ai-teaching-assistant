"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import ReactMarkdown, { type Components } from "react-markdown"
import rehypeRaw from "rehype-raw"
import remarkGfm from "remark-gfm"
import { ArrowUpRight, BookOpenCheck, Info } from "lucide-react"
import { slugifyHeading } from "@/lib/docs-slug"

type DocsArticleProps = {
  title: string
  description: string
  content: string
}

function textFromChildren(children: ReactNode): string {
  if (typeof children === "string" || typeof children === "number") return String(children)
  if (Array.isArray(children)) return children.map(textFromChildren).join("")
  if (children && typeof children === "object" && "props" in children) {
    return textFromChildren((children as { props: { children?: ReactNode } }).props.children)
  }
  return ""
}

function createHeading(level: 2 | 3, seen: Map<string, number>) {
  const Heading = ({ children }: { children?: ReactNode }) => {
    const title = textFromChildren(children)
    const baseId = slugifyHeading(title)
    const count = seen.get(baseId) ?? 0
    seen.set(baseId, count + 1)
    const id = count === 0 ? baseId : `${baseId}-${count + 1}`
    const Tag = level === 2 ? "h2" : "h3"

    return (
      <Tag
        id={id}
        className={level === 2
          ? "group relative scroll-mt-28 pt-8 text-2xl font-semibold tracking-[-0.02em] text-foreground first:pt-0"
          : "group scroll-mt-28 text-lg font-semibold tracking-tight text-foreground"}
      >
        <a href={`#${id}`} className="decoration-transparent hover:decoration-muted-foreground">
          {children}
          <span aria-hidden="true" className="ml-2 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground">#</span>
        </a>
      </Tag>
    )
  }

  Heading.displayName = `DocsHeading${level}`
  return Heading
}

export function DocsArticle({ title, description, content }: DocsArticleProps) {
  const seen = new Map<string, number>()
  const components: Components = {
    h2: createHeading(2, seen),
    h3: createHeading(3, seen),
    h4: ({ children }) => <h4 className="scroll-mt-28 text-base font-semibold tracking-tight text-foreground">{children}</h4>,
    p: ({ children }) => <p className="text-[15px] leading-7 text-foreground/78">{children}</p>,
    ul: ({ children }) => <ul className="ml-5 list-disc space-y-2 text-[15px] leading-7 text-foreground/78 marker:text-muted-foreground">{children}</ul>,
    ol: ({ children }) => <ol className="ml-5 list-decimal space-y-2 text-[15px] leading-7 text-foreground/80 marker:font-medium marker:text-muted-foreground">{children}</ol>,
    li: ({ children }) => <li className="pl-1">{children}</li>,
    strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
    a: ({ href = "", children }) => {
      const external = href.startsWith("http")
      if (external) {
        return <a href={href} target="_blank" rel="noreferrer" className="font-medium text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary">{children}<ArrowUpRight className="ml-0.5 inline size-3" /></a>
      }
      return <Link href={href} className="font-medium text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary">{children}</Link>
    },
    blockquote: ({ children }) => (
      <aside className="flex gap-3 rounded-lg border bg-muted/35 px-4 py-3 text-sm [&>p]:m-0">
        <Info className="mt-1 size-4 shrink-0 text-primary" />
        <div>{children}</div>
      </aside>
    ),
    code: ({ className, children }) => className ? (
      <code className={`${className} font-mono text-[13px]`}>{children}</code>
    ) : (
      <code className="rounded-md border bg-muted px-1.5 py-0.5 font-mono text-[0.875em] text-foreground">{children}</code>
    ),
    pre: ({ children }) => <pre tabIndex={0} className="overflow-x-auto rounded-lg border bg-zinc-950 p-5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">{children}</pre>,
    hr: () => <hr className="my-10 border-border" />,
    table: ({ children }) => <div className="overflow-x-auto rounded-lg border"><table className="w-full border-collapse text-left text-sm">{children}</table></div>,
    thead: ({ children }) => <thead className="bg-muted/70 text-foreground">{children}</thead>,
    th: ({ children }) => <th className="border-b px-4 py-3 font-semibold">{children}</th>,
    td: ({ children }) => <td className="border-b px-4 py-3 text-foreground/75 last:[tr:last-child_&]:border-b-0">{children}</td>,
    img: ({ src, alt }) => (
      <img
        src={src}
        alt={alt || "Documentation screenshot"}
        loading="lazy"
        className="my-8 w-full rounded-lg border bg-muted/20"
      />
    ),
    details: ({ children }) => (
      <details className="group rounded-lg border bg-background px-5 py-4 open:bg-muted/25">
        {children}
      </details>
    ),
    summary: ({ children }) => (
      <summary className="cursor-pointer select-none font-medium text-foreground marker:text-muted-foreground">
        {children}
      </summary>
    ),
    figure: ({ children }) => <figure className="my-8 space-y-2">{children}</figure>,
    figcaption: ({ children }) => (
      <figcaption className="text-center text-xs leading-5 text-muted-foreground">{children}</figcaption>
    ),
    kbd: ({ children }) => (
      <kbd className="rounded border bg-muted/50 px-1.5 py-0.5 font-mono text-xs font-medium text-foreground shadow-sm">{children}</kbd>
    ),
    input: ({ type, checked, ...props }) => (
      <input
        type={type}
        checked={checked}
        readOnly={type === "checkbox" ? true : undefined}
        className="mr-2 size-4 align-[-2px] accent-primary"
        {...props}
      />
    ),
  }

  return (
    <article>
      <header className="mb-12">
        <div className="mb-4 flex size-9 items-center justify-center rounded-md border bg-muted/35 text-muted-foreground">
          <BookOpenCheck className="size-4" />
        </div>
        <h1 className="max-w-3xl text-balance text-3xl font-bold tracking-[-0.035em] text-foreground sm:text-[40px] sm:leading-[1.1]">{title}</h1>
        <p className="mt-3 max-w-2xl text-balance text-base leading-7 text-muted-foreground sm:text-lg">{description}</p>
      </header>
      <div className="space-y-6">
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={components}>
          {content}
        </ReactMarkdown>
      </div>
    </article>
  )
}
