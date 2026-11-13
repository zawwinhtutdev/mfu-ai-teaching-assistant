#!/usr/bin/env node
/**
 * Seed course FAQs and assignments.
 *
 * The FAQ table drives the vector-search half of grounded answering
 * (`match_faqs`), and `assignments` is what deadline reminders are derived
 * from. Both were empty in every seeded environment, so those two spec
 * features had code but no data behind them.
 *
 * FAQs are embedded with the configured embedding model, because `match_faqs`
 * filters on `embedding IS NOT NULL` — an unembedded FAQ is invisible to
 * retrieval. Assignments need no embedding.
 *
 * Usage:
 *   node scripts/seed-course-content.mjs           # seed
 *   node scripts/seed-course-content.mjs --dry-run # show what would change
 *
 * Idempotent: FAQs match on (course_id, question), assignments on
 * (course_id, title).
 */

import fs from "node:fs"
import process from "node:process"

import { createClient } from "@supabase/supabase-js"

const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/+$/, "")
const EMBEDDING_MODEL = process.env.OLLAMA_EMBEDDING_MODEL || "nomic-embed-text"

/** Days from today, so seeded deadlines stay in the future and fire reminders. */
function daysFromNow(days) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + days)
  date.setUTCHours(23, 59, 0, 0)
  return date.toISOString()
}

/**
 * FAQs per course code.
 *
 * Written to match the seeded materials, because a FAQ that contradicts the
 * handbook produces confident wrong answers rather than a refusal.
 */
const FAQS = {
  CSB321: [
    [
      "When is the Business Model Canvas assignment due?",
      "The Business Model Canvas assignment is due on 20 November and is worth 20 points.",
    ],
    [
      "How many people should be in a project team?",
      "Teams have four members on the semester-long venture project.",
    ],
    [
      "What are the nine blocks of the Business Model Canvas?",
      "Customer segments, value propositions, channels, customer relationships, revenue streams, key resources, key activities, key partnerships, and cost structure.",
    ],
    [
      "What topics does CSB321 cover?",
      "Customer discovery, business models, pricing, validation experiments, and pitching to investors.",
    ],
    [
      "How many credits is CSB321 worth?",
      "CSB321 is a 3-credit course taught by Dr. Anan Suwan.",
    ],
    [
      "Is attendance mandatory?",
      "Class meets Tuesday and Thursday 09:00-10:30. Attendance expectations are set by the lecturer; ask Dr. Anan Suwan for the current policy.",
    ],
  ],
  CSD323: [
    [
      "How many papers should the literature review cite?",
      "The term project is a literature review of 12 to 15 papers, accompanied by a reproduction plan.",
    ],
    [
      "What happens in each seminar session?",
      "One team presents a paper each week, and discussants prepare questions in advance.",
    ],
    [
      "What is the term project for CSD323?",
      "A literature review of 12-15 papers that includes a reproduction plan for the methods described.",
    ],
  ],
  CSD322: [
    [
      "How is authentication enforced in a platform?",
      "Authentication is enforced at the edge, before requests reach application code.",
    ],
    [
      "What are the platform architecture layers?",
      "Edge, application, data, and platform services.",
    ],
    [
      "Why should operations be idempotent?",
      "Idempotent operations can be retried safely, which matters because stateless request handling means a client may repeat a request.",
    ],
  ],
  CSM324: [
    [
      "What is hedging language?",
      "Language that softens a claim, such as 'may' or 'suggests', used to keep academic statements appropriately cautious.",
    ],
    [
      "How are weekly writing tasks submitted?",
      "Weekly writing tasks are submitted through the course workspace.",
    ],
    [
      "What skills does CSM324 cover?",
      "Thesis statements, paragraph unity, hedging language, and citation conventions for academic writing.",
    ],
  ],
  GEN311: [
    [
      "How is GEN311 assessed?",
      "Assessment is a group presentation plus a reflective essay.",
    ],
    [
      "What does global citizenship cover?",
      "Intercultural communication, the sustainable development goals, and civic engagement.",
    ],
  ],
  CSA411: [
    [
      "What does CSA411 focus on?",
      "Automated test design and tooling, with a focus on AI-assisted test generation and maintenance.",
    ],
  ],
  "AI-EDU": [
    [
      "Who is AI for Edu week for?",
      "It is a staff development week on practical uses of AI in teaching and course administration.",
    ],
  ],
}

const ASSIGNMENTS = {
  CSB321: [
    {
      title: "Business Model Canvas",
      instructions:
        "Complete all nine blocks of the Business Model Canvas for your venture and justify each choice with evidence from customer interviews. Worth 20 points.",
      dueInDays: 2,
      points: 20,
    },
    {
      title: "Venture Pitch Deck",
      instructions:
        "Ten-slide deck pitching your venture to a mock investor panel, covering problem, solution, market, business model, and traction.",
      dueInDays: 21,
      points: 30,
    },
  ],
  CSD323: [
    {
      title: "Literature Review Draft",
      instructions:
        "Submit a draft reviewing 12-15 papers in your chosen area, with a reproduction plan for the key method you identify.",
      dueInDays: 5,
      points: 25,
    },
    {
      title: "Paper Presentation",
      instructions: "Present your assigned paper for 20 minutes and lead questions as a discussant for one other paper.",
      dueInDays: 12,
      points: 15,
    },
  ],
  CSD322: [
    {
      title: "Platform Architecture Proposal",
      instructions:
        "Describe the edge, application, data, and platform services layers for a system of your choice, and explain where authentication is enforced.",
      dueInDays: 3,
      points: 20,
    },
  ],
  CSM324: [
    {
      title: "Reflective Writing Portfolio",
      instructions: "Compile four weekly writing tasks with a short reflection on the feedback you received.",
      dueInDays: 7,
      points: 20,
    },
  ],
  GEN311: [
    {
      title: "Group Presentation",
      instructions:
        "Present on one sustainable development goal and its relevance to Thailand, with roles divided across the group.",
      dueInDays: 9,
      points: 30,
    },
  ],
  CSA411: [
    {
      title: "AI-Assisted Test Suite",
      instructions: "Build and evaluate an AI-assisted test suite for a small service, reporting on precision and maintenance cost.",
      dueInDays: 14,
      points: 25,
    },
  ],
}

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return
  for (const rawLine of fs.readFileSync(file, "utf8").split("\n")) {
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
    if (process.env[key] === undefined) process.env[key] = value
  }
}

async function embed(question) {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: [question] }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    throw new Error(
      `Ollama embed failed (${response.status}). Is \`ollama pull ${EMBEDDING_MODEL}\` done? ${detail.slice(0, 200)}`,
    )
  }

  const payload = await response.json()
  const vector = payload?.embeddings?.[0]
  if (!Array.isArray(vector) || vector.length !== 768) {
    throw new Error(`Expected a 768-dim embedding, got ${Array.isArray(vector) ? vector.length : "none"}`)
  }
  return `[${vector.map((value) => Number(value).toFixed(8)).join(",")}]`
}

async function main() {
  loadEnvFile(".env.local")

  const dryRun = process.argv.includes("--dry-run")
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (.env.local).")
    process.exit(1)
  }

  // Service role: seeding is an administrative action, and FAQ/assignment
  // writes would otherwise be blocked by the teacher-ownership policies.
  const supabase = createClient(url, key, { auth: { persistSession: false } })

  const { data: courses, error: courseError } = await supabase.from("courses").select("id, code")
  if (courseError) throw courseError
  if (!courses?.length) {
    console.error("No courses found. Run the Supabase seed first.")
    process.exit(1)
  }

  const courseIdByCode = new Map(courses.map((course) => [course.code, course.id]))

  let faqsInserted = 0
  let assignmentsInserted = 0

  for (const [code, entries] of Object.entries(FAQS)) {
    const courseId = courseIdByCode.get(code)
    if (!courseId) {
      console.warn(`  skip  ${code}: course not found`)
      continue
    }

    // Existing questions are skipped before embedding, so re-running does not
    // pay for vectors that already exist.
    const { data: existing } = await supabase
      .from("faqs")
      .select("question")
      .eq("course_id", courseId)
    const existingQuestions = new Set((existing ?? []).map((row) => row.question))

    for (const [question, answer] of entries) {
      if (existingQuestions.has(question)) continue
      if (dryRun) {
        console.log(`  would add FAQ  ${code}: ${question}`)
        continue
      }

      let embeddingLiteral = null
      try {
        embeddingLiteral = await embed(question)
      } catch (error) {
        // An unembedded FAQ is still readable in the teacher UI and by keyword,
        // so keep going and report it rather than failing the whole seed.
        console.warn(`  warning  no embedding for "${question}": ${error.message}`)
      }

      const { error } = await supabase.from("faqs").insert({
        course_id: courseId,
        question,
        answer,
        ...(embeddingLiteral ? { embedding: embeddingLiteral } : {}),
      })

      if (error) {
        console.error(`  failed FAQ  ${code}: ${error.message}`)
      } else {
        faqsInserted += 1
      }
    }
  }

  for (const [code, entries] of Object.entries(ASSIGNMENTS)) {
    const courseId = courseIdByCode.get(code)
    if (!courseId) continue

    const { data: existing } = await supabase
      .from("assignments")
      .select("title")
      .eq("course_id", courseId)
    const existingTitles = new Set((existing ?? []).map((row) => row.title))

    for (const assignment of entries) {
      if (existingTitles.has(assignment.title)) continue
      if (dryRun) {
        console.log(`  would add assignment  ${code}: ${assignment.title}`)
        continue
      }

      const { error } = await supabase.from("assignments").insert({
        course_id: courseId,
        title: assignment.title,
        instructions: assignment.instructions,
        due_at: daysFromNow(assignment.dueInDays),
        points: assignment.points,
        visible_to_students: true,
      })

      if (error) {
        console.error(`  failed assignment  ${code}: ${error.message}`)
      } else {
        assignmentsInserted += 1
      }
    }
  }

  console.log(
    dryRun
      ? "dry run complete"
      : `seeded ${faqsInserted} FAQs and ${assignmentsInserted} assignments`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
