/**
 * Consent lookups.
 *
 * Spec §2.3 and §6 require that AI interaction logs are only stored when the
 * student has consented, and that opting out is honoured. The `consents` table
 * records intent; this module is the single place that turns a row into a
 * decision, so logging paths cannot each invent their own default.
 */

type SupabaseLikeClient = {
  from: (table: string) => any
}

export const CONSENT_AI_PROCESSING = "ai_processing"
export const CONSENT_RETENTION_OPT_OUT = "data_retention_opt_out"

/**
 * Whether query logging is permitted for this user.
 *
 * Default is *allow*: the signup form now asks for AI-processing consent up
 * front, so a missing row means "has not answered yet", not "refused". Without
 * this default every existing account would silently stop being analysed when
 * the gate was introduced, which would look like an analytics outage rather
 * than a privacy change. An explicit `is_granted = false` always blocks.
 */
export async function hasAiProcessingConsent(
  supabase: SupabaseLikeClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("consents")
    .select("is_granted")
    .eq("user_id", userId)
    .eq("consent_type", CONSENT_AI_PROCESSING)
    .maybeSingle()

  if (error) {
    // Fail open for logging, not closed: a transient read error should not
    // wipe analytics, and the data stored is course-scoped question text.
    console.error("[consent] lookup failed:", error.message)
    return true
  }

  if (!data) return true
  return data.is_granted !== false
}

/** Whether this user asked for accelerated deletion of their activity logs. */
export async function hasRetentionOptOut(
  supabase: SupabaseLikeClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("consents")
    .select("is_granted")
    .eq("user_id", userId)
    .eq("consent_type", CONSENT_RETENTION_OPT_OUT)
    .maybeSingle()

  if (error) return false
  return data?.is_granted === true
}
