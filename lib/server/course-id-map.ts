/**
 * Bridge between the portal's course ids and the RAG service's course ids.
 *
 * The app has two course tables:
 *
 *   Supabase `courses`      uuid id, e.g. a5f8e6a3-…   <- what the portal uses
 *   FastAPI `courses`       text id, e.g. course-csb321 <- what RAG uses
 *
 * Both describe the same courses but share no id, so passing one to the other
 * fails with "You do not have access to this course" — the RAG service looks up
 * a uuid it has never heard of. Document storage, chunking, and retrieval all
 * live in the RAG service, so the boundary needs an explicit translation rather
 * than a guess based on id shape.
 *
 * Mapping is by course code, which is unique in both databases.
 */

import { createClient } from "@/lib/supabase/server"

type SupabaseLikeClient = {
  from: (table: string) => any
}

/**
 * Supabase course uuid -> RAG course id.
 *
 * Returns the input unchanged when it is already a service id (`course-…`) or
 * cannot be resolved, so a caller that already speaks the service's language
 * keeps working.
 */
export async function toRagCourseId(
  supabase: SupabaseLikeClient,
  courseIdOrCode: string,
): Promise<string | null> {
  const raw = (courseIdOrCode || "").trim()
  if (!raw) return null

  // Already a service id.
  if (raw.startsWith("course-")) return raw

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (UUID_RE.test(raw)) {
    const { data } = await supabase.from("courses").select("code").eq("id", raw).maybeSingle()
    if (!data?.code) return null
    return `course-${String(data.code).toLowerCase()}`
  }

  // A bare course code such as "CSB321".
  return `course-${raw.toLowerCase()}`
}

/**
 * RAG course id -> Supabase course uuid.
 *
 * Used when returning the service's responses to the portal, which joins and
 * filters by uuid. Unknown ids are returned as-is rather than nulled, so a
 * mismatch is visible in the UI instead of silently dropping a document.
 */
export async function toPortalCourseId(
  supabase: SupabaseLikeClient,
  ragCourseId: string | null | undefined,
): Promise<string | null> {
  const raw = (ragCourseId || "").trim()
  if (!raw) return null

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (UUID_RE.test(raw)) return raw

  const code = raw.startsWith("course-") ? raw.slice("course-".length) : raw
  const { data } = await supabase
    .from("courses")
    .select("id")
    .eq("code", code.toUpperCase())
    .maybeSingle()

  return data?.id ?? raw
}

/** Rewrite `course_id` on one document record. */
export async function mapDocumentCourseId<T extends { course_id?: string | null }>(
  supabase: SupabaseLikeClient,
  document: T,
): Promise<T> {
  if (!document?.course_id) return document
  const mapped = await toPortalCourseId(supabase, document.course_id)
  return { ...document, course_id: mapped }
}

/** Rewrite `course_id` on a list of document records in one pass. */
export async function mapDocumentCourseIds<T extends { course_id?: string | null }>(
  supabase: SupabaseLikeClient,
  documents: T[],
): Promise<T[]> {
  return Promise.all(documents.map((document) => mapDocumentCourseId(supabase, document)))
}
