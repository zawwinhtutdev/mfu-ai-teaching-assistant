#!/usr/bin/env node
/**
 * Answer-accuracy evaluation against the live pipeline.
 *
 * Spec §9 asks for "Accuracy: % of correct answers from chatbot (target >= 85%)".
 * The previous harness measured recall, refusal accuracy and citation support.
 * Those are grounding metrics, not correctness: a system can retrieve the right
 * passage, cite it correctly, and still answer the wrong question.
 *
 * Each case therefore declares the facts a correct answer must contain, so
 * scoring is an exact check and each metric is reported separately.
 *
 * Usage:
 *   node scripts/eval-answers.mjs
 *   node scripts/eval-answers.mjs --course CSB321
 *   node scripts/eval-answers.mjs --json
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
const CHAT_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:7b"
const EMBED_MODEL = process.env.OLLAMA_EMBEDDING_MODEL || "nomic-embed-text"

const REFUSAL_TEXT = "The course materials do not cover this."

const args = process.argv.slice(2)
const asJson = args.includes("--json")
const courseFilter = args.includes("--course") ? args[args.indexOf("--course") + 1] : null

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.")
  process.exit(1)
}

const REST_HEADERS = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }

async function rest(pathname) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${pathname}`, { headers: REST_HEADERS })
  if (!response.ok) {
    throw new Error(`${pathname} -> ${response.status} ${(await response.text()).slice(0, 200)}`)
  }
  return response.json()
}

async function embed(text) {
  const response = await fetch(`${OLLAMA_URL}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, input: [text] }),
  })
  if (!response.ok) throw new Error(`embed ${response.status}`)
  const payload = await response.json()
  const vector = payload.embeddings?.[0]
  if (!Array.isArray(vector)) throw new Error("no embedding returned")
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1
  return vector.map((value) => value / norm)
}

function buildContext(hits, maxChars) {
  const sources = []
  const blocks = []
  let used = 0
  for (const hit of hits) {
    const content = String(hit.chunk_text || "").trim()
    if (!content) continue
    if (blocks.length > 0 && used + content.length > maxChars) break
    const n = sources.length + 1
    sources.push({ n, title: hit.material_title || "Material", content })
    blocks.push(`[${n}] (${hit.material_title || "Material"}, section ${hit.chunk_index + 1})\n${content}`)
    used += content.length
  }
  return { text: blocks.join("\n\n"), sources }
}

function groundedPrompt(contextText) {
  return [
    "You answer questions using ONLY the SOURCES below.",
    "",
    "Rules:",
    "1. Support every factual sentence with a citation marker like [1].",
    "2. Use only information contained in the sources. Do not use outside knowledge.",
    `3. If the sources do not contain the answer, reply exactly: "${REFUSAL_TEXT}"`,
    "4. Keep answers concise (at most 180 words).",
    "",
    "SOURCES",
    contextText,
  ].join("\n")
}

/** One answer through retrieval then generation, mirroring the app's flow. */
async function answerFor(courseId, question) {
  const started = Date.now()
  const vector = await embed(question)

  const rpc = await fetch(`${SUPABASE_URL}/rest/v1/rpc/match_course_material_chunks`, {
    method: "POST",
    headers: { ...REST_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({
      p_course_id: courseId,
      p_query_embedding: `[${vector.join(",")}]`,
      p_match_count: 6,
      p_material_id: null,
    }),
  })
  const hits = (await rpc.json()).filter((hit) => (hit.similarity ?? 0) > 0.15)

  const built = buildContext(hits, 6000)
  if (built.sources.length === 0) {
    return { answer: REFUSAL_TEXT, sources: [], latency: Date.now() - started }
  }

  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: CHAT_MODEL,
      stream: false,
      messages: [
        { role: "system", content: groundedPrompt(built.text) },
        { role: "user", content: question },
      ],
    }),
  })
  if (!response.ok) throw new Error(`chat ${response.status}`)
  const payload = await response.json()

  return {
    answer: String(payload.message?.content || "").trim(),
    sources: built.sources,
    latency: Date.now() - started,
  }
}

/** `expect_all` lists facts a correct answer must contain. */
const CASES = [
  // CSB321 — Software Business Entrepreneurship
  { id: "csb321-instructor", course: "CSB321", question: "Who is the instructor for this course?", expect: "answer", expect_all: ["anan"] },
  { id: "csb321-credits", course: "CSB321", question: "How many credits is this course worth?", expect: "answer", expect_all: ["3"] },
  { id: "csb321-class-time", course: "CSB321", question: "On which days does this class meet?", expect: "answer", expect_all: ["tuesday", "thursday"] },
  { id: "csb321-team-size", course: "CSB321", question: "How many students are in each project team?", expect: "answer", expect_all: ["four"] },
  { id: "csb321-topics", course: "CSB321", question: "What topics does this course cover?", expect: "answer", expect_all: ["customer discovery"] },
  { id: "csb321-canvas-due", course: "CSB321", question: "When is the Business Model Canvas assignment due?", expect: "answer", expect_all: ["20 november"] },
  { id: "csb321-canvas-points", course: "CSB321", question: "How many points is the Canvas assignment worth?", expect: "answer", expect_all: ["20"] },
  { id: "csb321-canvas-blocks", course: "CSB321", question: "What are the nine blocks of the Business Model Canvas?", expect: "answer", expect_all: ["customer segments", "revenue streams", "cost structure"] },
  { id: "csb321-refuse-phone", course: "CSB321", question: "What is the instructor's personal mobile number?", expect: "refusal" },
  { id: "csb321-refuse-exam", course: "CSB321", question: "What is the exact final exam date and room number?", expect: "refusal" },
  { id: "csb321-refuse-parking", course: "CSB321", question: "Where can I park my motorbike on campus?", expect: "refusal" },

  // CSD323 — Seminar in Software Engineering
  { id: "csd323-litreview-count", course: "CSD323", question: "How many papers should the literature review cite?", expect: "answer", expect_all: ["12"] },
  { id: "csd323-session-format", course: "CSD323", question: "What happens in each seminar session?", expect: "answer", expect_all: ["present"] },

  // CSD322 — Platform Development
  { id: "csd322-auth", course: "CSD322", question: "How is authentication enforced in a platform?", expect: "answer", expect_all: ["edge"] },
  { id: "csd322-layers", course: "CSD322", question: "What are the platform architecture layers?", expect: "answer", expect_all: ["edge", "application", "data"] },
  { id: "csd322-refuse-grades", course: "CSD322", question: "What grade did I receive on the last assignment?", expect: "refusal" },

  // CSM324 — Introduction to Formal English
  { id: "csm324-hedging", course: "CSM324", question: "What is hedging language?", expect: "answer", expect_all: ["soften"] },
  { id: "csm324-submission", course: "CSM324", question: "How are weekly writing tasks submitted?", expect: "answer", expect_all: ["workspace"] },

  // GEN311 — Global Citizenship
  { id: "gen311-assessment", course: "GEN311", question: "How is this course assessed?", expect: "answer", expect_all: ["presentation"] },
  { id: "gen311-scope", course: "GEN311", question: "What does global citizenship cover?", expect: "answer", expect_all: ["intercultural"] },

  // CSA411 — Software Automation Testing with AI
  { id: "csa411-focus", course: "CSA411", question: "What does this course focus on?", expect: "answer", expect_all: ["test"] },

  // Out-of-scope refusals that must not be invented
  { id: "csd323-refuse-tuition", course: "CSD323", question: "How much is my tuition fee for this semester?", expect: "refusal" },
  { id: "gen311-refuse-wifi", course: "GEN311", question: "What is the campus wifi password?", expect: "refusal" },
]

async function courseIdFor(code) {
  const rows = await rest(`courses?code=eq.${encodeURIComponent(code)}&select=id,code,title`)
  return rows[0] ?? null
}

function containsAll(answer, needles) {
  const haystack = answer.toLowerCase()
  return needles.every((needle) => haystack.includes(needle.toLowerCase()))
}

function citationValidity(answer, sources) {
  const markers = [...answer.matchAll(/\[(\d+)\]/g)].map((match) => Number(match[1]))
  if (markers.length === 0) return { present: false, valid: false }
  const valid = markers.every((n) => sources.some((source) => source.n === n))
  return { present: true, valid }
}

async function main() {
  console.log(`Supabase: ${SUPABASE_URL}`)
  console.log(`Ollama:   ${OLLAMA_URL} (${CHAT_MODEL} + ${EMBED_MODEL})\n`)

  await embed("warmup") // fail fast if the embedding model is missing

  const cases = courseFilter ? CASES.filter((c) => c.course === courseFilter) : CASES
  const rows = []

  for (const testCase of cases) {
    const course = await courseIdFor(testCase.course)
    if (!course) {
      console.log(`  skip  ${testCase.id}: course ${testCase.course} not found`)
      continue
    }

    let result
    try {
      result = await answerFor(course.id, testCase.question)
    } catch (error) {
      rows.push({ ...testCase, error: String(error.message || error), correct: false })
      console.log(`  ERROR ${testCase.id}: ${error.message || error}`)
      continue
    }

    const refused = result.answer.toLowerCase().includes(REFUSAL_TEXT.toLowerCase())
    const citations = citationValidity(result.answer, result.sources)

    // Correctness has two halves: a refusal case must refuse, and an answerable
    // case must contain the required facts without refusing.
    const correct =
      testCase.expect === "refusal"
        ? refused
        : !refused && containsAll(result.answer, testCase.expect_all || [])

    rows.push({
      id: testCase.id,
      expect: testCase.expect,
      refused,
      citations,
      correct,
      sources: result.sources.length,
      latency: result.latency,
      answer: result.answer.slice(0, 200),
    })

    console.log(
      `  ${correct ? "PASS" : "FAIL"}  ${testCase.id.padEnd(22)} ` +
        `cited=${citations.valid ? "yes" : "no "} src=${result.sources.length} ${result.latency}ms`,
    )
  }

  const scored = rows.filter((row) => !row.error)
  const answerable = scored.filter((row) => row.expect === "answer")
  const refusals = scored.filter((row) => row.expect === "refusal")
  const percent = (part, whole) => (whole === 0 ? 0 : Math.round((100 * part) / whole))

  const answerCorrect = answerable.filter((row) => row.correct).length
  const refusalCorrect = refusals.filter((row) => row.correct).length
  // Refusals are supposed to have no citations, so they are excluded from
  // validity — counting them would report a healthy system as broken.
  const answered = scored.filter((row) => !row.refused)
  const cited = answered.filter((row) => row.citations?.valid).length
  const latencies = scored.map((row) => row.latency).sort((a, b) => a - b)
  const p50 = latencies[Math.floor(latencies.length * 0.5)] ?? 0
  const p95 = latencies[Math.floor(latencies.length * 0.95)] ?? 0
  const accuracy = percent(answerCorrect, answerable.length)

  if (asJson) {
    const payload = {
      generatedAt: new Date().toISOString(),
      provider: `ollama:${CHAT_MODEL}`,
      embeddingModel: EMBED_MODEL,
      summary: {
        cases: rows.length,
        answerAccuracyPct: accuracy,
        refusalAccuracyPct: percent(refusalCorrect, refusals.length),
        citationValidityPct: percent(cited, answered.length),
        p50Ms: p50,
        p95Ms: p95,
        errors: rows.filter((row) => row.error).length,
      },
      rows,
    }
    // Write as well as print, so an evaluation result is a reviewable artifact
    // rather than something that only existed in a terminal scrollback.
    fs.writeFileSync(
      path.join(root, "services/api/evals/results-answers.json"),
      `${JSON.stringify(payload, null, 2)}\n`,
    )
    console.log("\n" + JSON.stringify(payload.summary, null, 2))
    if (accuracy < 85) process.exitCode = 1
    return
  }


  console.log("\n-- Results -------------------------------------")
  console.log(`  Answer accuracy    ${accuracy}%  (${answerCorrect}/${answerable.length}, target >= 85%)`)
  console.log(`  Refusal accuracy   ${percent(refusalCorrect, refusals.length)}%  (${refusalCorrect}/${refusals.length})`)
  console.log(`  Citation validity  ${percent(cited, answered.length)}%  (${cited}/${answered.length} answered)`)
  console.log(`  Latency            p50 ${p50}ms  p95 ${p95}ms`)
  console.log(`  Errors             ${rows.filter((row) => row.error).length}`)

  const failed = scored.filter((row) => !row.correct)
  if (failed.length > 0) {
    console.log("\n-- Failures ------------------------------------")
    for (const row of failed) {
      console.log(`  ${row.id}: expected ${row.expect}`)
      console.log(`    got: ${row.answer}`)
    }
  }

  // Non-zero exit so this can gate CI once the threshold holds.
  if (accuracy < 85) process.exitCode = 1
}

main().catch((error) => {
  console.error("\nEvaluation failed:", error?.message || error)
  process.exit(1)
})
