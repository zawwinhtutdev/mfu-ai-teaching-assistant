import { NextResponse } from "next/server"

import { roleForEmail } from "@/lib/auth/role-from-email"
import {
  assertCourseAccess,
  resolvePrincipal,
  type Principal,
} from "@/lib/server/principal"
import { createServiceRoleClient, hasServiceRoleKey } from "@/lib/supabase/admin"

/**
 * Teacher-side course roster management.
 *
 * The browser used to look students up in `profiles` and insert enrolment rows
 * itself. Both steps were blocked by RLS: a teacher cannot read a profile until
 * that student is already enrolled, and cannot insert an enrolment at all. Any
 * address that was not already on the roster produced "No student accounts
 * found" — including real students who simply had not been added yet.
 *
 * The route keeps the browser out of that corner:
 *   1. authorize the teacher against the course (owner or co-teacher),
 *   2. resolve addresses with the service role, bypassing RLS deliberately,
 *   3. enrol existing student accounts immediately,
 *   4. store an invitation for addresses that have no account yet. The signup
 *      trigger claims those invitations, so the student is enrolled the first
 *      time they sign in.
 */

export const dynamic = "force-dynamic"

const EMAIL_PATTERN = /^[^\s@,;()\\]+@[^\s@,;()\\]+\.[^\s@,;()\\]+$/
const MAX_EMAIL_LENGTH = 254
const MAX_EMAILS_PER_REQUEST = 200

type RouteContext = { params: Promise<{ courseId: string }> }

type RosterStudent = {
  id: string
  email: string
  full_name: string | null
  enrolled_at: string | null
}

type PendingInvitation = {
  id: string
  email: string
  created_at: string | null
}

type Authorized =
  | { ok: false; response: NextResponse }
  | {
      ok: true
      principal: Principal
      course: { id: string; code: string; title: string }
      supabase: ReturnType<typeof createServiceRoleClient>
    }

function normalizeEmails(input: unknown): string[] {
  if (!Array.isArray(input)) return []

  const seen = new Set<string>()
  for (const value of input) {
    if (typeof value !== "string") continue
    const email = value.trim().toLowerCase()
    if (!email || email.length > MAX_EMAIL_LENGTH) continue
    seen.add(email)
  }
  return Array.from(seen).slice(0, MAX_EMAILS_PER_REQUEST)
}

async function authorize(courseId: string): Promise<Authorized> {
  const principal = await resolvePrincipal()
  if (!principal) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  if (principal.isDemo) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            "Demo courses are read-only. Sign in with your real teacher account to manage enrollment.",
        },
        { status: 403 },
      ),
    }
  }

  if (principal.role !== "teacher" && principal.role !== "admin") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Only a teacher may manage this course roster" },
        { status: 403 },
      ),
    }
  }

  const course = await assertCourseAccess(principal, courseId)
  if (!course) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Course not found, or you do not teach it" },
        { status: 404 },
      ),
    }
  }

  if (!hasServiceRoleKey()) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Enrollment is not configured on this server" },
        { status: 503 },
      ),
    }
  }

  return { ok: true, principal, course, supabase: createServiceRoleClient() }
}

/** Treat `_` and `%` in an address as literal characters, not LIKE wildcards. */
function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`)
}

/**
 * Resolve several addresses in one round trip per chunk.
 *
 * `profiles.email` may preserve the case the identity provider returned and its
 * uniqueness is enforced on lower(email), so a case-insensitive match is the
 * correct lookup. Chunking keeps the PostgREST `or` filter inside URL limits
 * when a teacher pastes a long roster.
 */
async function findProfilesByEmails(
  supabase: ReturnType<typeof createServiceRoleClient>,
  emails: string[],
) {
  const profiles = new Map<string, any>()
  const chunkSize = 50

  for (let index = 0; index < emails.length; index += chunkSize) {
    const chunk = emails.slice(index, index + chunkSize)
    const filter = chunk
      .map((email) => `email.ilike.${escapeLikePattern(email)}`)
      .join(",")

    const { data, error } = await supabase
      .from("profiles")
      .select("id,email,role,full_name")
      .or(filter)

    if (error) return { profiles, error }

    for (const row of data ?? []) {
      profiles.set(String(row.email).toLowerCase(), row)
    }
  }

  return { profiles, error: null }
}

async function loadRoster(
  supabase: ReturnType<typeof createServiceRoleClient>,
  courseId: string,
) {
  const [enrollmentResult, invitationResult] = await Promise.all([
    supabase
      .from("course_enrollments")
      .select("student_id, enrolled_at, profiles:student_id(id, email, full_name)")
      .eq("course_id", courseId),
    supabase
      .from("course_invitations")
      .select("id, email, created_at")
      .eq("course_id", courseId)
      .order("created_at", { ascending: true }),
  ])

  if (enrollmentResult.error) return { error: enrollmentResult.error, enrolled: [], invitations: [] }
  if (invitationResult.error) return { error: invitationResult.error, enrolled: [], invitations: [] }

  const enrolled = (enrollmentResult.data ?? [])
    .map((row: any) => {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
      if (!profile) return null
      return {
        id: profile.id as string,
        email: profile.email as string,
        full_name: (profile.full_name ?? null) as string | null,
        enrolled_at: (row.enrolled_at ?? null) as string | null,
      }
    })
    .filter(Boolean) as RosterStudent[]

  const invitations = (invitationResult.data ?? []).map((row: any) => ({
    id: row.id as string,
    email: row.email as string,
    created_at: (row.created_at ?? null) as string | null,
  })) as PendingInvitation[]

  return { error: null, enrolled, invitations }
}

/**
 * POST — add one or more addresses to the course.
 *
 * Existing student accounts are enrolled now. Addresses without an account get
 * a pending invitation instead, so a teacher never has to wait for students to
 * sign up before building the roster.
 */
export async function POST(req: Request, { params }: RouteContext) {
  const { courseId } = await params
  const auth = await authorize(courseId)
  if (!auth.ok) return auth.response

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const emails = normalizeEmails(body?.emails)
  if (emails.length === 0) {
    return NextResponse.json({ error: "Enter at least one email address" }, { status: 400 })
  }

  const { supabase, course, principal } = auth

  const [enrollmentResult, invitationResult] = await Promise.all([
    supabase.from("course_enrollments").select("student_id").eq("course_id", course.id),
    supabase.from("course_invitations").select("id, email").eq("course_id", course.id),
  ])

  if (enrollmentResult.error) {
    return NextResponse.json({ error: enrollmentResult.error.message }, { status: 500 })
  }
  if (invitationResult.error) {
    return NextResponse.json({ error: invitationResult.error.message }, { status: 500 })
  }

  const enrolledStudentIds = new Set(
    (enrollmentResult.data ?? []).map((row: any) => row.student_id as string),
  )
  const invitedEmails = new Set(
    (invitationResult.data ?? []).map((row: any) => (row.email as string).toLowerCase()),
  )

  const toEnroll: Array<{ studentId: string; email: string }> = []
  const toInvite: string[] = []
  const alreadyEnrolled: string[] = []
  const alreadyInvited: string[] = []
  const skipped: Array<{ email: string; reason: string }> = []
  // Any address that resolves to an enrolled student makes a pending
  // invitation redundant, including accounts enrolled before invitations
  // existed. Clear those rows rather than leaving a phantom "pending" entry.
  const claimableEmails: string[] = []

  const validEmails = emails.filter((email) => EMAIL_PATTERN.test(email))
  const { profiles, error: profileLookupError } = await findProfilesByEmails(
    supabase,
    validEmails,
  )
  if (profileLookupError) {
    return NextResponse.json({ error: profileLookupError.message }, { status: 500 })
  }

  for (const email of emails) {
    if (!EMAIL_PATTERN.test(email)) {
      skipped.push({ email, reason: "That is not a valid email address" })
      continue
    }

    const profile = profiles.get(email)
    if (profile) {
      if (profile.role !== "student") {
        skipped.push({
          email,
          reason: "This address belongs to a staff account, not a student",
        })
        continue
      }

      if (enrolledStudentIds.has(profile.id)) {
        alreadyEnrolled.push(email)
        claimableEmails.push(email)
        continue
      }

      toEnroll.push({ studentId: profile.id, email })
      claimableEmails.push(email)
      continue
    }

    // No account yet. Only addresses that will be created as students may be
    // invited, otherwise the invitation could never be claimed.
    if (roleForEmail(email) !== "student") {
      skipped.push({
        email,
        reason: "Use a student address ending with @lamduan.mfu.ac.th",
      })
      continue
    }

    if (invitedEmails.has(email)) {
      alreadyInvited.push(email)
      continue
    }

    toInvite.push(email)
  }

  if (toEnroll.length > 0) {
    const { error } = await supabase.from("course_enrollments").upsert(
      toEnroll.map((entry) => ({ course_id: course.id, student_id: entry.studentId })),
      { onConflict: "course_id,student_id", ignoreDuplicates: true },
    )
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  if (claimableEmails.length > 0) {
    // An existing account may also have received an invitation in the past
    // (for example the account was created before this migration existed).
    // Enrolling it makes that invitation redundant.
    await supabase
      .from("course_invitations")
      .delete()
      .eq("course_id", course.id)
      .in("email", claimableEmails)
  }

  if (toInvite.length > 0) {
    const { error } = await supabase.from("course_invitations").upsert(
      toInvite.map((email) => ({
        course_id: course.id,
        email,
        invited_by: principal.userId,
      })),
      { onConflict: "course_id,email", ignoreDuplicates: true },
    )
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  const roster = await loadRoster(supabase, course.id)
  if (roster.error) {
    return NextResponse.json({ error: roster.error.message }, { status: 500 })
  }

  return NextResponse.json({
    enrolled: toEnroll.map((entry) => entry.email),
    invited: toInvite,
    alreadyEnrolled,
    alreadyInvited,
    skipped,
    enrolledStudents: roster.enrolled,
    pendingInvitations: roster.invitations,
  })
}

/** DELETE ?studentId= — remove an enrolment, or ?invitationId= — revoke an invite. */
export async function DELETE(req: Request, { params }: RouteContext) {
  const { courseId } = await params
  const auth = await authorize(courseId)
  if (!auth.ok) return auth.response

  const { supabase, course } = auth
  const url = new URL(req.url)
  const studentId = url.searchParams.get("studentId")
  const invitationId = url.searchParams.get("invitationId")

  if (!studentId && !invitationId) {
    return NextResponse.json(
      { error: "studentId or invitationId is required" },
      { status: 400 },
    )
  }

  if (studentId) {
    const { error } = await supabase
      .from("course_enrollments")
      .delete()
      .eq("course_id", course.id)
      .eq("student_id", studentId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  }

  // Scoping by course prevents a teacher from deleting another course's invite
  // by guessing its id.
  const { error } = await supabase
    .from("course_invitations")
    .delete()
    .eq("id", invitationId)
    .eq("course_id", course.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
