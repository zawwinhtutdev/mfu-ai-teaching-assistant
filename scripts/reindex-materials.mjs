#!/usr/bin/env node
/**
 * Reindex course materials into `course_material_chunks`.
 *
 * Why this exists: indexing used to run inline during upload and depended on a
 * Gemini embedding key. Without that key every upload failed to produce chunks,
 * so retrieval had nothing to search and the assistant refused everything. With
 * embeddings now served by Ollama, this backfills material that predates the
 * change and re-runs indexing after a model swap.
 *
 * Usage:
 *   node scripts/reindex-materials.mjs            # all materials
 *   node scripts/reindex-materials.mjs --course CSB321
 *   node scripts/reindex-materials.mjs --dry-run
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the
 * environment (loaded from .env.local by default).
 */

import fs from "node:fs"
import path from "node:path"
import process from "node:process"

const root = process.cwd()

function loadEnvFile(file) {
  const full = path.join(root, file)
  if (!fs.existsSync(full)) return
  for (const rawLine of fs.readFileSync(full, "utf8").split("\n")) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue
    const eq = line.indexOf("=")
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

loadEnvFile(".env.local")
loadEnvFile(".env")

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const OLLAMA_URL = (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/+$/, "")
const EMBED_MODEL = process.env.OLLAMA_EMBEDDING_MODEL || "nomic-embed-text"

const CHUNK_CHARS = Number(process.env.COURSE_RAG_CHUNK_CHARS || 1400)
const CHUNK_OVERLAP = Number(process.env.COURSE_RAG_CHUNK_OVERLAP_CHARS || 220)

const args = process.argv.slice(2)
const dryRun = args.includes("--dry-run")
const courseFilter = args.includes("--course")
  ? args[args.indexOf("--course") + 1]
  : null

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.")
  process.exit(1)
}

function headers(extra = {}) {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  }
}

async function rest(pathname) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${pathname}`, { headers: headers() })
  if (!response.ok) {
    throw new Error(`${pathname} -> ${response.status} ${(await response.text()).slice(0, 200)}`)
  }
  return response.json()
}

function normalizeWhitespace(input) {
  return input.replace(/\r\n/g, "\n").replace(/\u0000/g, "").replace(/\n{3,}/g, "\n\n").trim()
}

/** Mirrors splitIntoChunks in lib/ai/course-rag.ts so indexing matches upload. */
function splitIntoChunks(text, maxChars = CHUNK_CHARS, overlap = CHUNK_OVERLAP) {
  const normalized = normalizeWhitespace(text)
  if (!normalized) return []

  const chunks = []
  let cursor = 0

  while (cursor < normalized.length) {
    let end = Math.min(cursor + maxChars, normalized.length)
    if (end < normalized.length) {
      const paragraphBreak = normalized.lastIndexOf("\n\n", end)
      const sentenceBreak = normalized.lastIndexOf(". ", end)
      const boundary = Math.max(paragraphBreak, sentenceBreak)
      if (boundary > cursor + Math.floor(maxChars * 0.55)) {
        end = boundary + (boundary === sentenceBreak ? 1 : 0)
      }
    }
    const chunk = normalized.slice(cursor, end).trim()
    if (chunk) chunks.push(chunk)
    if (end >= normalized.length) break
    cursor = Math.max(end - overlap, cursor + 1)
  }

  return chunks
}

async function embed(texts) {
  if (texts.length === 0) return []
  const response = await fetch(`${OLLAMA_URL}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts }),
  })
  if (!response.ok) {
    throw new Error(
      `Ollama embed ${response.status}: ${(await response.text()).slice(0, 200)}. ` +
        `Is \`ollama pull ${EMBED_MODEL}\` done?`,
    )
  }
  const payload = await response.json()
  const vectors = Array.isArray(payload.embeddings) ? payload.embeddings : []
  if (vectors.length !== texts.length) {
    throw new Error(`Ollama returned ${vectors.length} embeddings for ${texts.length} inputs`)
  }
  return vectors.map((vector) => {
    const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1
    return vector.map((value) => value / norm)
  })
}

async function main() {
  console.log(`Supabase: ${SUPABASE_URL}`)
  console.log(`Ollama:   ${OLLAMA_URL} (${EMBED_MODEL})`)
  console.log(dryRun ? "Mode:     dry run\n" : "Mode:     write\n")

  // Confirm the embedding model is reachable before touching any rows.
  await embed(["warmup"])

  const query = courseFilter
    ? `course_materials?select=id,course_id,title,content,courses!inner(code)&courses.code=eq.${encodeURIComponent(courseFilter)}`
    : "course_materials?select=id,course_id,title,content"
  const materials = await rest(query)

  if (!Array.isArray(materials) || materials.length === 0) {
    console.log("No materials found.")
    return
  }

  let indexed = 0
  let chunkTotal = 0
  let skipped = 0

  for (const material of materials) {
    const chunks = splitIntoChunks(String(material.content || ""))
    const label = `${material.title} (${String(material.id).slice(0, 8)})`

    if (chunks.length === 0) {
      console.log(`  skip  ${label}: no extractable text`)
      skipped += 1
      continue
    }

    if (dryRun) {
      console.log(`  would ${chunks.length} chunks  ${label}`)
      chunkTotal += chunks.length
      continue
    }

    const vectors = await embed(chunks)
    const rows = chunks.map((chunk, index) => ({
      course_id: material.course_id,
      material_id: material.id,
      chunk_index: index,
      chunk_text: chunk,
      embedding: `[${vectors[index].join(",")}]`,
    }))

    // Replace, do not append: re-running must be idempotent.
    const del = await fetch(
      `${SUPABASE_URL}/rest/v1/course_material_chunks?material_id=eq.${material.id}`,
      { method: "DELETE", headers: headers() },
    )
    if (!del.ok) throw new Error(`delete chunks -> ${del.status}`)

    const insert = await fetch(`${SUPABASE_URL}/rest/v1/course_material_chunks`, {
      method: "POST",
      headers: headers({ Prefer: "return=minimal" }),
      body: JSON.stringify(rows),
    })
    if (!insert.ok) {
      throw new Error(`insert chunks -> ${insert.status} ${(await insert.text()).slice(0, 300)}`)
    }

    console.log(`  ok    ${chunks.length} chunks  ${label}`)
    indexed += 1
    chunkTotal += chunks.length
  }

  console.log(
    `\n${dryRun ? "Would index" : "Indexed"} ${indexed} material(s), ${chunkTotal} chunk(s)` +
      (skipped ? `, skipped ${skipped}` : ""),
  )
}

main().catch((error) => {
  console.error("\nReindex failed:", error?.message || error)
  process.exit(1)
})
