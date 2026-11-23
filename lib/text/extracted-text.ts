/**
 * Clean text extracted from PDFs and Office files.
 *
 * PDFs that draw headings character-by-character come back as
 * "S O F T W A R E" and slide counters as "1 3 0 5", which reads as garbage
 * next to the real content. Lines that are mostly single characters are layout
 * artefacts, not prose, so they are dropped; surviving lines have their spaced
 * runs collapsed.
 */

/** A line that is really a page number, slide counter or letter-spaced heading. */
function looksLikeLayoutNoise(line: string) {
  const trimmed = line.trim()
  if (!trimmed) return false

  // Only digits and punctuation: page numbers, slide counters, separators.
  if (/^[\d\s.,:;·|_/\\-]+$/.test(trimmed)) return true

  const tokens = trimmed.split(/[ \t]+/).filter(Boolean)
  if (tokens.length >= 4) {
    const singleCharacterTokens = tokens.filter(
      (token) => token.replace(/[^\p{L}\p{N}]/gu, "").length <= 1,
    ).length
    // "S O F T W A R E" / "# S L I D E S" — individual glyphs, not words.
    if (singleCharacterTokens / tokens.length >= 0.6) return true
  }

  return false
}

export function cleanExtractedText(input: string) {
  const normalized = input.replace(/\r\n/g, "\n").replace(/\u0000/g, "")

  const kept = normalized.split("\n").filter((line) => !looksLikeLayoutNoise(line))

  let text = kept.join("\n")

  // Remaining inline runs from kerning: "S O F T W A R E" -> "SOFTWARE".
  text = text.replace(/\b(?:[A-Za-z][ \t]+){2,}[A-Za-z]\b/g, (run) => run.replace(/[ \t]+/g, ""))
  text = text.replace(/\b(?:[0-9][ \t]+){1,}[0-9]\b/g, (run) => run.replace(/[ \t]+/g, ""))

  return text.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim()
}
