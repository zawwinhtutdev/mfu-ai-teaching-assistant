import "server-only"

import { readFile } from "node:fs/promises"
import path from "node:path"
import {
  docsPages,
  getDocsBreadcrumbs,
  getDocsPageByHref,
  type DocsSearchItem,
} from "@/lib/docs-config"

export type DocsHeading = {
  id: string
  title: string
  level: 2 | 3
}

export type DocsPageContent = {
  title: string
  description: string
  content: string
  headings: DocsHeading[]
}

const docsDirectory = path.join(process.cwd(), "content", "docs")

function stripMarkdown(value: string) {
  return value
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
    .replace(/[*_`~]/g, "")
    .trim()
}

export function slugifyHeading(value: string) {
  return stripMarkdown(value)
    .toLowerCase()
    .replace(/[^a-z0-9\u0E00-\u0E7F]+/g, "-")
    .replace(/^-|-$/g, "")
}

function extractHeadings(content: string): DocsHeading[] {
  const seen = new Map<string, number>()

  return content
    .split("\n")
    .map((line) => {
      const match = /^(##|###)\s+(.+)$/.exec(line)
      if (!match) return null

      const title = stripMarkdown(match[2].replace(/\s+#+$/, ""))
      const baseId = slugifyHeading(title)
      const count = seen.get(baseId) ?? 0
      seen.set(baseId, count + 1)

      return {
        id: count === 0 ? baseId : `${baseId}-${count + 1}`,
        title,
        level: match[1].length as 2 | 3,
      }
    })
    .filter((heading): heading is DocsHeading => heading !== null)
}

function parseFrontmatter(source: string) {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(source)
  if (!match) return { data: new Map<string, string>(), content: source }

  const data = new Map<string, string>()
  for (const line of match[1].split("\n")) {
    const separator = line.indexOf(":")
    if (separator === -1) continue
    const key = line.slice(0, separator).trim()
    const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "")
    data.set(key, value)
  }

  return { data, content: match[2].trim() }
}

export async function getDocsContent(href: string): Promise<DocsPageContent | null> {
  const page = getDocsPageByHref(href)
  if (!page) return null

  try {
    const source = await readFile(path.join(docsDirectory, page.file), "utf8")
    const { data, content } = parseFrontmatter(source)

    return {
      title: data.get("title") || page.title,
      description: data.get("description") || page.description,
      content,
      headings: extractHeadings(content),
    }
  } catch {
    return null
  }
}

function searchableText(content: string) {
  return content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^\)]+\)/g, " ")
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
    .replace(/[#>*_`~|\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export async function getDocsSearchIndex(): Promise<DocsSearchItem[]> {
  const entries = await Promise.all(
    docsPages.map(async (page) => {
      const pageContent = await getDocsContent(page.href)
      if (!pageContent) return null

      return {
        ...page,
        section: getDocsBreadcrumbs(page.href)[0],
        content: searchableText(pageContent.content),
      }
    }),
  )

  return entries.filter((entry): entry is DocsSearchItem => entry !== null)
}

export async function getAllDocsMarkdown() {
  const pages = await Promise.all(
    docsPages.map(async (page) => {
      const pageContent = await getDocsContent(page.href)
      if (!pageContent) return null

      return [
        `# ${pageContent.title}`,
        "",
        pageContent.description,
        "",
        `Source: ${page.href}`,
        "",
        pageContent.content,
      ].join("\n")
    }),
  )

  return [
    "# MFU AI Teaching Assistant Documentation",
    "",
    "Public product documentation for students, teachers, and administrators.",
    "",
    ...pages.filter((page): page is string => page !== null).map((page) => `${page}\n\n---\n`),
  ].join("\n")
}
