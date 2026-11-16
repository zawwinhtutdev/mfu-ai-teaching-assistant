/**
 * In-process rate limiting for the AI routes.
 *
 * Every AI route spends money on a provider call (or many seconds of CPU on a
 * local model) and nothing limited how often one account could trigger them. A
 * single signed-in user holding down the send button, or a bug that retries in
 * a loop, could exhaust the Gemini free tier or make the app unusable for
 * everyone else sharing the process.
 *
 * This is a fixed-window counter in module memory. That is deliberately modest:
 * the deployment is one container, so there is no second process whose counters
 * would need to agree. It does NOT survive a restart, and it would need to move
 * to Redis if the app were ever scaled horizontally. The limitations are real,
 * so they are documented in docs/DEPLOY.md rather than left implicit.
 */

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

/**
 * Ceiling on tracked keys. Without this, a flood of distinct keys (one per
 * user, or one per forged cookie) would grow the map without bound — the
 * limiter itself would become the memory leak.
 */
const MAX_BUCKETS = 10_000

export type RateLimitResult = {
  ok: boolean
  limit: number
  remaining: number
  /** Epoch millis at which the window resets and the counter returns to zero. */
  resetAt: number
  /** Whole seconds until `resetAt`, already rounded up for `Retry-After`. */
  retryAfterSeconds: number
}

/**
 * Per-route limits. Chat is the most expensive (it retrieves course context and
 * streams a full answer), the one-shot generators run a whole completion, and
 * the planner is a single short completion.
 */
export const RATE_LIMITS = {
  chat: { limit: 30, windowMs: 60_000 },
  generation: { limit: 12, windowMs: 60_000 },
  planner: { limit: 20, windowMs: 60_000 },
} as const

/** Drop expired buckets, and if still oversized, the ones expiring soonest. */
function sweep(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }

  if (buckets.size <= MAX_BUCKETS) return

  // Map preserves insertion order, which is not expiry order, so sort explicitly.
  const byExpiry = [...buckets.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt)
  for (const [key] of byExpiry.slice(0, buckets.size - MAX_BUCKETS)) {
    buckets.delete(key)
  }
}

/**
 * Count one attempt against `key` and report whether it is allowed.
 *
 * The window starts on the first request and does not extend on later ones, so
 * a client cannot hold a bucket open indefinitely by trickling requests.
 */
export function checkRateLimit(
  key: string,
  options: { limit: number; windowMs: number },
  now: number = Date.now(),
): RateLimitResult {
  const { limit, windowMs } = options

  if (buckets.size > MAX_BUCKETS / 2) {
    sweep(now)
  }

  const existing = buckets.get(key)
  const bucket =
    existing && existing.resetAt > now ? existing : { count: 0, resetAt: now + windowMs }

  bucket.count += 1
  buckets.set(key, bucket)

  const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))

  return {
    ok: bucket.count <= limit,
    limit,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt,
    retryAfterSeconds,
  }
}

/**
 * Standard 429 with the headers a well-behaved client needs: `Retry-After` so
 * the UI can say when to retry, and `X-RateLimit-*` for diagnostics.
 */
export function rateLimitResponse(result: RateLimitResult) {
  return Response.json(
    {
      error: "Too many requests. Please wait a moment before trying again.",
      code: "rate_limited",
      retryAfterSeconds: result.retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSeconds),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
      },
    },
  )
}

/**
 * Rate limit key for an authenticated caller.
 *
 * Limits are charged per account rather than per IP: students on campus share
 * one NAT address, so an IP-keyed limit would let one heavy user lock out a
 * whole classroom. The route has already authenticated by this point, so the
 * user id is always available.
 */
export function userRateLimitKey(scope: string, userId: string) {
  return `${scope}:${userId}`
}

/** Test hook — clears all counters so a test starts from a known state. */
export function resetRateLimits() {
  buckets.clear()
}
