import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { DocsArticle } from "@/components/docs/docs-article"
import { DocsShell } from "@/components/docs/docs-shell"
import {
  docsPages,
  getDocsBreadcrumbs,
  getDocsPageByHref,
  getDocsPageNeighbors,
} from "@/lib/docs-config"
import { getDocsContent } from "@/lib/docs"

type DocsPageProps = {
  params: Promise<{ slug?: string[] }>
}

function hrefFromSlug(slug?: string[]) {
  return slug?.length ? `/docs/${slug.join("/")}` : "/docs"
}

export function generateStaticParams() {
  return docsPages.map((page) => ({
    slug: page.href === "/docs" ? [] : page.href.replace("/docs/", "").split("/"),
  }))
}

export async function generateMetadata({ params }: DocsPageProps): Promise<Metadata> {
  const { slug } = await params
  const href = hrefFromSlug(slug)
  const page = getDocsPageByHref(href)

  if (!page) return {}

  return {
    title: `${page.title} | MFU AI Documentation`,
    description: page.description,
  }
}

export default async function DocumentationPage({ params }: DocsPageProps) {
  const { slug } = await params
  const href = hrefFromSlug(slug)
  const page = getDocsPageByHref(href)
  const content = await getDocsContent(href)

  if (!page || !content) notFound()

  const { previous, next } = getDocsPageNeighbors(href)
  const breadcrumbs = getDocsBreadcrumbs(href)

  return (
    <DocsShell
      currentHref={href}
      headings={content.headings}
      previous={previous}
      next={next}
      breadcrumbs={breadcrumbs}
      pageTitle={content.title}
      pageMarkdown={content.content}
    >
      <DocsArticle title={content.title} description={content.description} content={content.content} />
    </DocsShell>
  )
}
