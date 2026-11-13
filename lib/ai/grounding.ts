/**
 * Grounded answering: context assembly, prompt, and citation repair.
 *
 * Ported from the FastAPI service (`app/rag/{prompts,context,citation_repair}.py`)
 * so that retrieval and generation happen against the Supabase schema the rest
 * of the app already uses. The logic is deliberately unchanged: this is a port,
 * not a rewrite, because those three pieces were tuned against a 25-case
 * evaluation set and their measured behaviour is known.
 *
 * The contract is the same as before:
 *   - sources are numbered, deduplicated, and budgeted;
 *   - every factual sentence must carry a marker like [1];
 *   - a marker that a different source supports better is rewritten;
 *   - no relevant source means the fixed refusal sentence, not a guess.
 */

export const REFUSAL_TEXT = "The course materials do not cover this."

/** Two chunks sharing this much vocabulary are treated as the same passage. */
const DUPLICATE_JACCARD = 0.8

/** Minimum token overlap before a citation is considered wrongly attached. */
const MIN_OVERLAP = 0.2
/** How much better another source must fit before a marker is rewritten. */
const MARGIN = 0.15

const STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "when", "are", "use", "used",
  "should", "must", "will", "from", "into", "not", "but", "its", "their",
  "they", "have", "has", "was", "were", "which", "what", "than", "then",
])

export type Source = {
  /** 1-based marker number used in the answer. */
  n: number
  materialId: string
  materialTitle: string
  chunkIndex: number
  content: string
}

export type BuiltContext = {
  text: string
  sources: Source[]
}

export type Revision = {
  sentence: string
  from: number
  to: number
}

function words(text: string): Set<string> {
  const tokens = text.toLowerCase().match(/[a-z0-9_.]+/g) ?? []
  return new Set(tokens.filter((token) => token.length > 3 || STOPWORDS.has(token)))
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let shared = 0
  for (const value of a) if (b.has(value)) shared += 1
  return shared / (a.size + b.size - shared)
}

/**
 * Deduplicate, budget, and number retrieved chunks.
 *
 * The budget stops adding sources once it is exceeded rather than truncating a
 * passage mid-sentence: a half-supplied chunk produces citations that look
 * supported but are not.
 */
export function buildContext(
  hits: Array<{
    material_id: string
    material_title: string | null
    chunk_index: number
    chunk_text: string
  }>,
  maxChars: number,
): BuiltContext {
  const sources: Source[] = []
  const blocks: string[] = []
  const seenKeys = new Set<string>()
  const keptWordSets: Set<string>[] = []
  let used = 0

  for (const hit of hits) {
    const key = `${hit.material_id}:${hit.chunk_index}`
    if (seenKeys.has(key)) continue

    const content = String(hit.chunk_text || "").trim()
    if (!content) continue

    const wordSet = words(content)
    if (keptWordSets.some((kept) => jaccard(wordSet, kept) >= DUPLICATE_JACCARD)) continue

    if (blocks.length > 0 && used + content.length > maxChars) break

    const n = sources.length + 1
    sources.push({
      n,
      materialId: hit.material_id,
      materialTitle: hit.material_title || "Material",
      chunkIndex: hit.chunk_index,
      content,
    })

    blocks.push(
      `[${n}] (${hit.material_title || "Material"}, section ${hit.chunk_index + 1})\n${content}`,
    )

    seenKeys.add(key)
    keptWordSets.push(wordSet)
    used += content.length
  }

  return { text: blocks.join("\n\n"), sources }
}

export function groundedSystemPrompt(contextText: string, toneInstruction?: string): string {
  return [
    "You answer questions using ONLY the SOURCES below.",
    "",
    "Rules:",
    "1. Support every factual sentence or bullet with a citation marker like [1] or [2]",
    "   at the end of the statement. Never cite a number that is not in SOURCES, and",
    "   never repeat the same citation twice in a row (do not write [2] [2]).",
    "2. Use only information contained in the sources. Do not use outside knowledge.",
    `3. If the sources do not contain the answer, reply exactly: "${REFUSAL_TEXT}"`,
    "4. Format your answer with clean Markdown:",
    "   - Put each bullet point on its own line (e.g. `- **Topic**: concise explanation [1]`).",
    "   - Place citation markers at the end of the sentence or bullet, not before a colon.",
    "   - Keep answers concise (at most 180 words) and do not copy raw source blocks verbatim.",
    toneInstruction ? `5. ${toneInstruction}` : "",
    "",
    "SOURCES",
    contextText,
  ]
    .filter((line) => line !== "")
    .join("\n")
}

/** Prompt used when retrieval found nothing: refuse, do not speculate. */
export function refusalPrompt(toneInstruction?: string): string {
  return [
    "You are an AI teaching assistant for a university course.",
    `The course materials retrieved for this question contained nothing relevant.`,
    `Reply with exactly: "${REFUSAL_TEXT}"`,
    "Do not speculate, and do not use outside knowledge.",
    toneInstruction || "",
  ]
    .filter(Boolean)
    .join("\n")
}

const MARKER_RE = /\[(\d+)\]/
/** Sentence-ish segments ending at a citation marker. */
const SEGMENT_RE = /[^.!?\n]{8,}\[\d+\]/g

/**
 * Rewrite citation markers that point at a source which does not support them.
 *
 * Deterministic and auditable: every change is reported. A small local model
 * often answers correctly but attaches the wrong number; prompting did not fix
 * that reliably (76% support with three prompt variants), so the marker is
 * corrected against the chunks we actually supplied.
 */
export function repairCitations(text: string, sources: Source[]): {
  text: string
  revisions: Revision[]
} {
  if (sources.length === 0) return { text, revisions: [] }

  const byNumber = new Map(sources.map((source) => [source.n, source]))
  const revisions: Revision[] = []

  for (const segment of text.match(SEGMENT_RE) ?? []) {
    const marker = MARKER_RE.exec(segment)
    if (!marker) continue

    const cited = Number(marker[1])
    if (!byNumber.has(cited)) continue

    const claim = words(segment.slice(0, marker.index))
    if (claim.size === 0) continue

    let best = cited
    let bestScore = -1
    let citedScore = 0

    for (const [number, source] of byNumber) {
      const sourceWords = words(source.content)
      let shared = 0
      for (const word of claim) if (sourceWords.has(word)) shared += 1
      const score = shared / claim.size

      if (number === cited) citedScore = score
      if (score > bestScore) {
        bestScore = score
        best = number
      }
    }

    if (best !== cited && bestScore >= MIN_OVERLAP && bestScore - citedScore >= MARGIN) {
      revisions.push({ sentence: segment.trim(), from: cited, to: best })
    }
  }

  let repaired = text
  for (const revision of revisions) {
    repaired = repaired.replace(
      revision.sentence,
      revision.sentence.replace(`[${revision.from}]`, `[${revision.to}]`),
    )
  }

  // Collapse consecutive duplicate citations such as "[2] [2]" or "[2][2]".
  repaired = repaired.replace(/(\[\d+\])(?:\s*\1)+/g, "$1")

  return { text: repaired, revisions }
}

/** True when the model refused rather than answered. */
export function isRefusal(text: string): boolean {
  return text.toLowerCase().includes(REFUSAL_TEXT.toLowerCase())
}

/** Distinct material titles cited in an answer, in first-mention order. */
export function citedTitles(text: string, sources: Source[]): string[] {
  const byNumber = new Map(sources.map((source) => [source.n, source]))
  const titles: string[] = []
  for (const match of text.matchAll(/\[(\d+)\]/g)) {
    const source = byNumber.get(Number(match[1]))
    if (source && !titles.includes(source.materialTitle)) titles.push(source.materialTitle)
  }
  return titles
}
