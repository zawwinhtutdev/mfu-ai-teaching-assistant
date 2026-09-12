"use client"

import type { ReactNode } from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  BookOpenCheck,
  Bot,
  Brain,
  CalendarDays,
  ChartNoAxesCombined,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clipboard,
  Copy,
  Download,
  Files,
  FolderCog,
  FolderPlus,
  FolderUp,
  GraduationCap,
  Home,
  Landmark,
  LayoutList,
  LifeBuoy,
  Lightbulb,
  Link2,
  LockKeyhole,
  LogIn,
  Menu,
  MessageCircle,
  MessageSquareText,
  PanelsTopLeft,
  Presentation,
  Scale,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UserPlus,
  UsersRound,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { BrandIcon } from "@/components/brand-icon"
import {
  docsNavigation,
  docsPages,
  isDocsNavGroup,
  type DocsNavGroup,
  type DocsNavItem,
  type DocsNavNode,
  type DocsSearchItem,
} from "@/lib/docs-config"
import type { DocsHeading } from "@/lib/docs"
import { cn } from "@/lib/utils"

const icons: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  "user-plus": UserPlus,
  "log-in": LogIn,
  "panels-top-left": PanelsTopLeft,
  "graduation-cap": GraduationCap,
  "message-circle": MessageCircle,
  "message-square-text": MessageSquareText,
  brain: Brain,
  files: Files,
  presentation: Presentation,
  bot: Bot,
  "folder-up": FolderUp,
  "folder-plus": FolderPlus,
  "folder-cog": FolderCog,
  "chart-no-axes-combined": ChartNoAxesCombined,
  "shield-check": ShieldCheck,
  "circle-help": CircleHelp,
  wrench: Wrench,
  "calendar-days": CalendarDays,
  landmark: Landmark,
  settings: Settings,
  "layout-list": LayoutList,
  lightbulb: Lightbulb,
  "book-open-check": BookOpenCheck,
  "badge-check": BadgeCheck,
  scale: Scale,
  "sliders-horizontal": SlidersHorizontal,
  "users-round": UsersRound,
  "lock-keyhole": LockKeyhole,
  "scroll-text": ScrollText,
  "life-buoy": LifeBuoy,
}

type DocsShellProps = {
  currentHref: string
  headings: DocsHeading[]
  previous: DocsNavItem | null
  next: DocsNavItem | null
  breadcrumbs: string[]
  pageTitle: string
  pageMarkdown: string
  children: ReactNode
}

function DocsLogo() {
  return (
    <Link href="/docs" className="flex min-w-0 items-center gap-2.5 text-foreground" aria-label="MFU AI documentation home">
      <BrandIcon size={34} priority className="shrink-0 rounded-full" />
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-sm font-semibold">MFU AI</span>
        <span className="block truncate text-[11px] text-muted-foreground">Documentation</span>
      </span>
    </Link>
  )
}

function groupContainsHref(group: DocsNavGroup, href: string): boolean {
  return group.items.some((node) =>
    isDocsNavGroup(node) ? groupContainsHref(node, href) : node.href === href,
  )
}

function SidebarPage({
  item,
  currentHref,
  depth,
  onNavigate,
}: {
  item: DocsNavItem
  currentHref: string
  depth: number
  onNavigate?: () => void
}) {
  const Icon = icons[item.icon] ?? Sparkles
  const active = item.href === currentHref

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-start gap-2.5 rounded-md py-1.5 pr-2 text-[13px] leading-5 transition-colors",
        depth === 0 ? "pl-3" : "pl-4",
        active
          ? "bg-primary/8 font-medium text-primary"
          : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 size-4 shrink-0",
          active ? "text-primary" : "text-muted-foreground/75 group-hover:text-foreground",
        )}
      />
      <span>{item.title}</span>
    </Link>
  )
}

function SidebarGroup({
  group,
  currentHref,
  depth,
  onNavigate,
}: {
  group: DocsNavGroup
  currentHref: string
  depth: number
  onNavigate?: () => void
}) {
  const hasActivePage = groupContainsHref(group, currentHref)
  const [open, setOpen] = useState(hasActivePage || group.defaultOpen === true)
  const Icon = icons[group.icon] ?? LayoutList

  useEffect(() => {
    if (hasActivePage) setOpen(true)
  }, [hasActivePage])

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className={cn(
          "group flex w-full items-start gap-2.5 rounded-md py-1.5 pr-2 text-left text-[13px] leading-5 transition-colors hover:bg-muted/70 hover:text-foreground",
          depth === 0 ? "pl-3" : "pl-4",
          hasActivePage ? "font-medium text-foreground" : "text-muted-foreground",
        )}
      >
        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
        <span className="flex-1">{group.title}</span>
        {open ? <ChevronDown className="mt-0.5 size-3.5 shrink-0" /> : <ChevronRight className="mt-0.5 size-3.5 shrink-0" />}
      </button>
      {open ? (
        <div className="relative ml-5 mt-1 space-y-0.5 border-l pl-2">
          {group.items.map((node) => (
            <SidebarNode
              key={isDocsNavGroup(node) ? `group-${node.title}` : node.href}
              node={node}
              currentHref={currentHref}
              depth={depth + 1}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function SidebarNode({
  node,
  currentHref,
  depth,
  onNavigate,
}: {
  node: DocsNavNode
  currentHref: string
  depth: number
  onNavigate?: () => void
}) {
  return isDocsNavGroup(node) ? (
    <SidebarGroup group={node} currentHref={currentHref} depth={depth} onNavigate={onNavigate} />
  ) : (
    <SidebarPage item={node} currentHref={currentHref} depth={depth} onNavigate={onNavigate} />
  )
}

type DocsAudience = "explore" | "students" | "teachers" | "admins"

const audienceLabels: Record<DocsAudience, string> = {
  explore: "Explore",
  students: "Learn",
  teachers: "Teach",
  admins: "Admin",
}

function audienceForHref(href: string): DocsAudience {
  if (href.startsWith("/docs/students")) return "students"
  if (href.startsWith("/docs/teachers")) return "teachers"
  if (href.startsWith("/docs/administrators")) return "admins"
  return "explore"
}

function sectionMatchesAudience(sectionTitle: string, audience: DocsAudience) {
  const shared = ["Getting started", "Account and support"]
  if (shared.includes(sectionTitle)) return true
  if (audience === "explore") return ["Core platform features", "AI skills and responsible use"].includes(sectionTitle)
  if (audience === "students") return ["Core platform features", "AI skills and responsible use", "For students"].includes(sectionTitle)
  if (audience === "teachers") return ["Core platform features", "AI skills and responsible use", "For teachers"].includes(sectionTitle)
  return sectionTitle === "Administration"
}

function SidebarNavigation({ currentHref, onNavigate }: { currentHref: string; onNavigate?: () => void }) {
  const audience = audienceForHref(currentHref)
  const sections = docsNavigation.filter((section) => sectionMatchesAudience(section.title, audience))

  return (
    <nav aria-label="Documentation navigation" className="pb-5">
      <div className="mb-5 px-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          {audienceLabels[audience]} path
        </p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">Only the guides most useful for this role are shown.</p>
      </div>

      <div className="space-y-7">
      {sections.map((section) => (
        <section key={section.title}>
          <h2 className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/70">
            {section.title}
          </h2>
          <div className="space-y-0.5">
            {section.items.map((node) => (
              <SidebarNode
                key={isDocsNavGroup(node) ? `group-${node.title}` : node.href}
                node={node}
                currentHref={currentHref}
                depth={0}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </section>
      ))}
      </div>
    </nav>
  )
}

function resultScore(page: DocsSearchItem, query: string) {
  const title = page.title.toLowerCase()
  const keywords = (page.keywords ?? []).join(" ").toLowerCase()
  const description = page.description.toLowerCase()
  const content = page.content.toLowerCase()
  let score = 0
  if (title === query) score += 100
  if (title.startsWith(query)) score += 40
  if (title.includes(query)) score += 25
  if (keywords.includes(query)) score += 15
  if (description.includes(query)) score += 8
  if (content.includes(query)) score += 2
  return score
}

function resultSnippet(page: DocsSearchItem, query: string) {
  if (!query) return page.description
  const lowerContent = page.content.toLowerCase()
  const index = lowerContent.indexOf(query)
  if (index === -1) return page.description
  const start = Math.max(0, index - 55)
  const end = Math.min(page.content.length, index + query.length + 95)
  return `${start > 0 ? "…" : ""}${page.content.slice(start, end)}${end < page.content.length ? "…" : ""}`
}

function SearchDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [query, setQuery] = useState("")
  const [pages, setPages] = useState<DocsSearchItem[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setQuery("")
    requestAnimationFrame(() => inputRef.current?.focus())
    if (pages.length > 0) return

    const controller = new AbortController()
    setLoading(true)
    fetch("/api/docs/search", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Documentation search is unavailable")
        return response.json() as Promise<DocsSearchItem[]>
      })
      .then(setPages)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return
        setPages([])
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [open, pages.length])

  const normalizedQuery = query.trim().toLowerCase()
  const results = useMemo(() => {
    if (!normalizedQuery) return pages.slice(0, 8)
    return pages
      .map((page) => ({ page, score: resultScore(page, normalizedQuery) }))
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((result) => result.page)
      .slice(0, 12)
  }, [normalizedQuery, pages])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center bg-black/40 px-4 pt-[10vh] backdrop-blur-[2px]"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search documentation"
        className="w-full max-w-2xl overflow-hidden rounded-2xl border bg-popover shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b px-4">
          <Search className="size-5 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => event.key === "Escape" && onClose()}
            placeholder="Search titles and page content..."
            className="h-14 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted"
          >
            ESC
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          <p className="px-3 pb-2 pt-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {normalizedQuery ? `${results.length} result${results.length === 1 ? "" : "s"}` : "Suggested pages"}
          </p>
          {loading ? (
            <div className="px-3 py-12 text-center text-sm text-muted-foreground">Loading search index…</div>
          ) : results.length > 0 ? (
            results.map((page) => {
              const Icon = icons[page.icon] ?? Sparkles
              return (
                <Link
                  key={page.href}
                  href={page.href}
                  onClick={onClose}
                  className="flex gap-3 rounded-xl px-3 py-3 hover:bg-muted"
                >
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background">
                    <Icon className="size-4 text-primary" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{page.title}</span>
                      <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">{page.section}</span>
                    </span>
                    <span className="mt-1 line-clamp-2 block text-xs leading-5 text-muted-foreground">
                      {resultSnippet(page, normalizedQuery)}
                    </span>
                  </span>
                </Link>
              )
            })
          ) : (
            <div className="px-3 py-12 text-center">
              <Search className="mx-auto mb-3 size-7 text-muted-foreground/50" />
              <p className="text-sm font-medium">No documentation found</p>
              <p className="mt-1 text-xs text-muted-foreground">Try a course, feature, or task name.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CopyMenu({ pageTitle, pageMarkdown }: { pageTitle: string; pageMarkdown: string }) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<"idle" | "copied">("idle")
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleOutside = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener("mousedown", handleOutside)
    return () => window.removeEventListener("mousedown", handleOutside)
  }, [open])

  const showCopied = () => {
    setStatus("copied")
    window.setTimeout(() => setStatus("idle"), 1600)
  }

  const copyMarkdown = async () => {
    await navigator.clipboard.writeText(`# ${pageTitle}\n\n${pageMarkdown}`)
    showCopied()
    setOpen(false)
  }

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href)
    showCopied()
    setOpen(false)
  }

  const downloadMarkdown = () => {
    const blob = new Blob([`# ${pageTitle}\n\n${pageMarkdown}`], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `${pageTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "documentation"}.md`
    anchor.click()
    URL.revokeObjectURL(url)
    setOpen(false)
  }

  return (
    <div ref={menuRef} className="relative flex shrink-0">
      <button
        type="button"
        onClick={copyMarkdown}
        className="flex h-9 items-center gap-2 rounded-l-lg border border-r-0 px-3 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        {status === "copied" ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
        {status === "copied" ? "Copied" : "Copy page"}
      </button>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label="More copy options"
        className="flex size-9 items-center justify-center rounded-r-lg border text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <ChevronDown className="size-3.5" />
      </button>
      {open ? (
        <div className="absolute right-0 top-11 z-30 w-52 rounded-xl border bg-popover p-1.5 shadow-xl">
          <button type="button" onClick={copyMarkdown} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs hover:bg-muted">
            <Clipboard className="size-3.5 text-muted-foreground" /> Copy as Markdown
          </button>
          <button type="button" onClick={copyLink} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs hover:bg-muted">
            <Link2 className="size-3.5 text-muted-foreground" /> Copy page link
          </button>
          <button type="button" onClick={downloadMarkdown} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs hover:bg-muted">
            <Download className="size-3.5 text-muted-foreground" /> Download .md
          </button>
        </div>
      ) : null}
    </div>
  )
}

function TableOfContents({
  headings,
  activeHeading,
}: {
  headings: DocsHeading[]
  activeHeading: string
}) {
  return (
    <nav className="space-y-1.5" aria-label="Guide sections">
      {headings.map((heading) => (
        <a
          key={heading.id}
          href={`#${heading.id}`}
          aria-current={activeHeading === heading.id ? "location" : undefined}
          className={cn(
            "relative block rounded-md py-1.5 pl-3 pr-2 text-[12px] leading-5 transition-colors hover:bg-muted/70 hover:text-foreground",
            heading.level === 3 && "pl-6",
            activeHeading === heading.id
              ? "font-medium text-primary before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-primary"
              : "text-muted-foreground",
          )}
        >
          {heading.title}
        </a>
      ))}
    </nav>
  )
}

function PageFeedback() {
  const [answer, setAnswer] = useState<"yes" | "no" | null>(null)

  return (
    <section className="mt-14 rounded-xl border bg-muted/25 p-5 sm:flex sm:items-center sm:justify-between">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Guide feedback</p>
        <h2 className="mt-1 text-sm font-semibold">Did this guide get you unstuck?</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {answer ? "Thanks—your response helps us improve the documentation." : "Tell us whether this guide answered your question."}
        </p>
      </div>
      {answer ? (
        <div className="mt-4 flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 sm:mt-0">
          <Check className="size-4" /> Response recorded
        </div>
      ) : (
        <div className="mt-4 flex gap-2 sm:mt-0">
          <button type="button" onClick={() => setAnswer("yes")} className="rounded-lg border bg-background px-3 py-2 text-xs font-medium hover:border-primary/40 hover:text-primary">
            Yes, I’m good
          </button>
          <button type="button" onClick={() => setAnswer("no")} className="rounded-lg border bg-background px-3 py-2 text-xs font-medium hover:border-primary/40 hover:text-primary">
            I still need help
          </button>
        </div>
      )}
    </section>
  )
}

export function DocsShell({
  currentHref,
  headings,
  previous,
  next,
  breadcrumbs,
  pageTitle,
  pageMarkdown,
  children,
}: DocsShellProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [activeHeading, setActiveHeading] = useState(headings[0]?.id ?? "")
  const [readingProgress, setReadingProgress] = useState(0)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setSearchOpen(true)
      }
      if (event.key === "Escape") {
        setMenuOpen(false)
        setSearchOpen(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  useEffect(() => {
    const updateReadingState = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight
      setReadingProgress(scrollable > 0 ? Math.min(100, Math.max(0, (window.scrollY / scrollable) * 100)) : 0)

      let current = headings[0]?.id ?? ""
      for (const heading of headings) {
        const element = document.getElementById(heading.id)
        if (element && element.getBoundingClientRect().top <= 150) current = heading.id
      }
      setActiveHeading(current)
    }

    updateReadingState()
    window.addEventListener("scroll", updateReadingState, { passive: true })
    window.addEventListener("resize", updateReadingState)
    return () => {
      window.removeEventListener("scroll", updateReadingState)
      window.removeEventListener("resize", updateReadingState)
    }
  }, [headings])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="fixed inset-x-0 top-0 z-50 h-20 border-b border-t-4 border-t-[#24262f] bg-background/95 backdrop-blur-xl">
        <div className="flex h-full w-full items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="flex size-9 items-center justify-center rounded-lg border text-muted-foreground hover:bg-muted lg:hidden"
              onClick={() => setMenuOpen(true)}
              aria-label="Open documentation navigation"
            >
              <Menu className="size-4" />
            </button>
            <div className="w-auto lg:w-[284px]">
              <DocsLogo />
            </div>
          </div>
          <div className="flex flex-1 justify-end px-2 lg:justify-center lg:px-4">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex h-10 w-10 items-center justify-center gap-3 rounded-lg border bg-background text-sm text-muted-foreground transition-colors hover:bg-muted/60 sm:w-full sm:max-w-md sm:justify-start sm:px-3"
              aria-label="Search documentation"
            >
              <Search className="size-4 shrink-0" />
              <span className="hidden flex-1 text-left sm:block">Search documentation...</span>
              <span className="hidden items-center gap-0.5 rounded border bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground sm:flex">
                <span>⌘</span>K
              </span>
            </button>
          </div>
          <div className="flex items-center justify-end gap-1">
            <a href="/" aria-label="Back to MFU AI platform" className="hidden items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground sm:flex">
              <Home className="size-4" />
              <span className="hidden 2xl:inline">Back to platform</span>
            </a>
            <ThemeToggle />
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-px bg-transparent">
          <div className="h-full bg-primary/70 transition-[width] duration-150" style={{ width: `${readingProgress}%` }} />
        </div>
      </header>

      {/* Fixed Left Sidebar */}
      <aside className="fixed bottom-0 left-0 top-20 z-30 hidden w-[300px] overflow-y-auto border-r bg-background px-4 py-7 lg:block">
        <SidebarNavigation currentHref={currentHref} />
        <div className="border-t px-1 pt-5">
          <Link href="/docs" className="flex items-center gap-3 rounded-lg border p-3 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground">
            <span className="flex size-9 items-center justify-center rounded-md bg-muted text-muted-foreground"><BookOpenCheck className="size-4" /></span>
            <span><strong className="block font-medium text-foreground">MFU Knowledge Studio</strong>{docsPages.length} practical guides</span>
          </Link>
        </div>
      </aside>

      {/* Main Content offset by fixed sidebar */}
      <div className="min-h-screen pt-20 lg:pl-[300px]">
        <div className="flex w-full items-start gap-8 px-5 py-8 sm:px-8 lg:gap-10 lg:px-10 lg:py-10 xl:gap-12 xl:px-12">
          <main className="min-w-0 max-w-[840px] flex-1">
            {headings.length > 0 ? (
              <details className="mb-7 rounded-lg border bg-background p-4 xl:hidden">
                <summary className="cursor-pointer text-sm font-medium">On this page</summary>
                <div className="mt-3">
                  <TableOfContents headings={headings} activeHeading={activeHeading} />
                </div>
              </details>
            ) : null}

            <div className="mb-7 flex min-h-9 items-start justify-between gap-4">
              <nav aria-label="Breadcrumb" className="flex min-w-0 flex-wrap items-center gap-1.5 pt-2 text-xs text-muted-foreground">
                <Link href="/docs" className="font-medium text-primary hover:underline">Documentation</Link>
                {breadcrumbs.map((breadcrumb) => (
                  <span key={breadcrumb} className="flex items-center gap-1.5">
                    <ChevronRight className="size-3" />
                    <span className="truncate">{breadcrumb}</span>
                  </span>
                ))}
              </nav>
              <CopyMenu pageTitle={pageTitle} pageMarkdown={pageMarkdown} />
            </div>

            {children}

            <PageFeedback />

            <nav aria-label="Documentation pagination" className="mt-10 grid gap-3 border-t pt-8 sm:grid-cols-2">
              {previous ? (
                <Link href={previous.href} className="group rounded-xl border p-4 transition-colors hover:border-primary/40 hover:bg-muted/40">
                  <span className="flex items-center gap-2 text-xs text-muted-foreground"><ArrowLeft className="size-3.5" /> Previous</span>
                  <span className="mt-1 block text-sm font-medium group-hover:text-primary">{previous.title}</span>
                </Link>
              ) : <span />}
              {next ? (
                <Link href={next.href} className="group rounded-xl border p-4 text-right transition-colors hover:border-primary/40 hover:bg-muted/40">
                  <span className="flex items-center justify-end gap-2 text-xs text-muted-foreground">Next <ArrowRight className="size-3.5" /></span>
                  <span className="mt-1 block text-sm font-medium group-hover:text-primary">{next.title}</span>
                </Link>
              ) : null}
            </nav>

            <footer className="mt-10 border-t py-8 text-center text-xs text-muted-foreground">
              MFU AI Knowledge Studio · practical guidance for learning, teaching, and platform operations
            </footer>
          </main>

          {/* Right TOC Sidebar */}
          <aside className="sticky top-20 hidden h-[calc(100vh-80px)] w-[250px] shrink-0 overflow-y-auto py-10 xl:block">
            <div className="px-1">
              <div className="mb-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <BarChart3 className="size-3.5" /> On this page
              </div>
              {headings.length > 0 ? (
                <TableOfContents headings={headings} activeHeading={activeHeading} />
              ) : (
                <p className="text-xs text-muted-foreground">This is a short overview guide.</p>
              )}
            </div>
            <div className="mt-7 border-t px-1 pt-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Can’t find it?</p>
              <p className="mt-2 text-sm font-semibold">Search the full MFU guide</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Search looks inside every page, not only page titles.</p>
              <button type="button" onClick={() => setSearchOpen(true)} className="mt-4 w-full rounded-lg border bg-background px-3 py-2 text-xs font-medium hover:bg-muted/60">
                Open search · ⌘ K
              </button>
            </div>
          </aside>
        </div>
      </div>

      {menuOpen ? (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <button type="button" className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} aria-label="Close navigation" />
          <aside className="absolute inset-y-0 left-0 w-[min(92vw,360px)] overflow-y-auto border-r bg-background shadow-2xl">
            <div className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background px-4">
              <DocsLogo />
              <button type="button" className="flex size-9 items-center justify-center rounded-lg border text-muted-foreground hover:bg-muted" onClick={() => setMenuOpen(false)} aria-label="Close navigation">
                <X className="size-4" />
              </button>
            </div>
            <div className="px-4 py-6">
              <SidebarNavigation currentHref={currentHref} onNavigate={() => setMenuOpen(false)} />
            </div>
          </aside>
        </div>
      ) : null}

      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}
