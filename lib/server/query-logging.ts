/**
 * The one place a student query is written to the analytics log.
 *
 * Spec §2.3 and §6 ask for anonymized logs unless explicit consent is given.
 * Before this module the chat route decided inline, in two separate branches,
 * and both choices were binary: log with the student id, or skip logging
 * entirely. That meant a student who never answered the consent prompt either
 * had fully attributable logs (a privacy violation) or produced no analytics at
 * all (which made the teacher dashboard look broken).
 *
 * Three outcomes, driven by the `consents` row:
 *
 *   is_granted = false -> do not write. The answer is still returned.
 *   is_granted = true  -> write with the student id.
 *   no row             -> write anonymized: counts, unattributable.
 *
 * The consent helper resolves "no row" and "explicitly granted" through
 * `hasAiProcessingConsent`, and a direct lookup distinguishes a refusal.
 */

import { CONSENT_AI_PROCESSING, hasAiProcessingConsent } from "@/lib/server/consent"

type SupabaseLikeClient = {
  from: (table: string) => any
}

export type QueryLogOutcome = "stored" | "stored_anonymized" | "declined" | "skipped"

export type QueryLogParams = {
  supabase: SupabaseLikeClient
  /** Real Supabase UUID. Demo seed ids are not persistable and must be skipped. */
  studentId: string | null
  courseId: string
  queryText: string
  responseText: string | null
  wasRefused?: boolean
  /** Only a real UUID can be written to the FK column. */
  canAttribute: boolean
}

/** How this student's queries may be logged. */
export async function resolveLoggingMode(
  supabase: SupabaseLikeClient,
  studentId: string,
): Promise<"granted" | "declined" | "unanswered"> {
  const { data, error } = await supabase
    .from("consents")
    .select("is_granted")
    .eq("user_id", studentId)
    .eq("consent_type", CONSENT_AI_PROCESSING)
    .maybeSingle()

  // A read failure is treated as "unanswered" rather than "granted": with the
  // anonymized path available there is no longer a trade-off between privacy
  // and having data, so the safe branch is also the useful one.
  if (error) {
    console.error("[query-log] consent lookup failed:", error.message)
    return "unanswered"
  }

  if (!data) return "unanswered"
  return data.is_granted === false ? "declined" : "granted"
}

/**
 * Record a query exchange if the student's consent allows it.
 *
 * Returns the outcome so callers can log what happened instead of silently
 * dropping a write.
 */
export async function logStudentQuery(params: QueryLogParams): Promise<QueryLogOutcome> {
  const { supabase, studentId, courseId, queryText, responseText, wasRefused, canAttribute } = params

  if (!courseId || !queryText) return "skipped"

  // A demo principal has no profile row, so the FK would reject any write.
  if (!studentId || !canAttribute) {
    return "skipped"
  }

  const mode = await resolveLoggingMode(supabase, studentId)

  if (mode === "declined") return "declined"

  const row: Record<string, unknown> = {
    course_id: courseId,
    query_text: queryText,
    response_text: responseText,
    was_refused: wasRefused,
  }

  if (mode === "granted") {
    row.student_id = studentId
    row.is_anonymized = false
  } else {
    // Nothing that could identify the student. The row still feeds
    // "common misunderstandings" and usage counts.
    row.student_id = null
    row.is_anonymized = true
  }

  const { error } = await supabase.from("student_queries").insert(row)

  if (error) {
    console.error("[query-log] insert failed:", error.message)
    return "skipped"
  }

  return mode === "granted" ? "stored" : "stored_anonymized"
}

/** Back-compat shim for callers that only need the boolean gate. */
export async function mayLogAttributed(
  supabase: SupabaseLikeClient,
  studentId: string,
): Promise<boolean> {
  return hasAiProcessingConsent(supabase, studentId)
}
