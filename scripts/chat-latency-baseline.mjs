#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import process from "node:process"

const baseUrl = (process.env.CHAT_BASE_URL || "http://localhost:3000").replace(/\/$/, "")
const runs = Number(process.env.CHAT_BASELINE_RUNS || 5)
const timeoutMs = Number(process.env.CHAT_BASELINE_TIMEOUT_MS || 30000)

const endpoint = `${baseUrl}/api/chat`
const controllerTimeout = () => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  return { controller, timeout }
}

async function runSingle(index) {
  const startedAt = Date.now()
  const { controller, timeout } = controllerTimeout()
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "default",
        transientChat: true,
        messages: [
          {
            id: `baseline-user-${index}`,
            role: "user",
            parts: [{ type: "text", text: "Reply with one short sentence: latency baseline test." }],
          },
        ],
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const text = await response.text().catch(() => "")
      throw new Error(`HTTP ${response.status} ${text}`.trim())
    }

    await response.text()
    return {
      ok: true,
      ms: Date.now() - startedAt,
    }
  } catch (error) {
    return {
      ok: false,
      ms: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function main() {
  const results = []
  for (let i = 0; i < runs; i += 1) {
    const result = await runSingle(i + 1)
    results.push(result)
    const status = result.ok ? "ok" : "failed"
    console.log(`[${i + 1}/${runs}] ${status} ${result.ms}ms${result.ok ? "" : ` (${result.error})`}`)
  }

  const successful = results.filter((row) => row.ok)
  const latencies = successful.map((row) => row.ms).sort((a, b) => a - b)
  const percentile = (p) => {
    if (latencies.length === 0) return null
    const index = Math.max(0, Math.min(latencies.length - 1, Math.floor((p / 100) * latencies.length)))
    return latencies[index]
  }

  const report = {
    endpoint,
    runs,
    successfulRuns: successful.length,
    failedRuns: runs - successful.length,
    timestamp: new Date().toISOString(),
    baseline: {
      minMs: latencies[0] ?? null,
      maxMs: latencies[latencies.length - 1] ?? null,
      avgMs: latencies.length ? Math.round(latencies.reduce((sum, ms) => sum + ms, 0) / latencies.length) : null,
      p50Ms: percentile(50),
      p90Ms: percentile(90),
      p95Ms: percentile(95),
    },
    results,
  }

  const reportsDir = path.join(process.cwd(), "reports")
  fs.mkdirSync(reportsDir, { recursive: true })
  const outputPath = path.join(reportsDir, "chat-latency-baseline.json")
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2))

  console.log(`\nSaved baseline report: ${outputPath}`)
  if (successful.length === 0) {
    process.exit(1)
  }
}

await main()

