/**
 * One place that answers "who is calling, and what may they read?".
 *
 * Why this exists: identity was previously resolved in two incompatible ways.
 * Portal pages used `getSessionContext`, which knew about demo cookies; the chat
 * API resolved a Supabase user and fell back to a synthetic `mock-student-1`.
 * Demo accounts in `lib/demo-seed.ts` (`kanya.wong@mfu.ac.th`) do not exist as
 * Supabase profiles, and the seeded auth users are a different set of addresses,
 * so a demo caller had no rows to authorize against and retrieval returned
 * nothing. Every course question became "the course materials do not cover
 * this".
 *
 * This module resolves either kind of session to a *single* identity, then uses
 * the demo seed's own enrollment data when the caller is a demo account. Real
 * sessions keep going through RLS.
 */

import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient, hasServiceRoleKey } from "@/lib/supabase/admin"
import {
  DEMO_EMAIL_COOKIE,
  DEMO_ROLE_COOKIE,
  findDemoAccountByEmail,
  isDemoRole,
} from "@/lib/demo-auth"
import { DEMO_STUDENTS, DEMO_TEACHERS } from "@/lib/demo-seed"
import { toUserRole } from "@/lib/auth/roles"

export type PrincipalRole = "student" | "teacher" | "admin"

export type Principal = {
  /** Supabase auth user id, or the demo seed id. Stable for analytics. */
  userId: string
  email: string
  role: PrincipalRole
  isDemo: boolean
  /** True when the id is a real Supabase UUID (safe to write as a foreign key). */
  isPersistable: boolean
  /**
   * Privileged client. Only present for demo callers, where RLS cannot apply
   * because there is no auth session. Course access is still checked against
   * the demo seed's enrollment data before this client is used for retrieval.
   */
  privilegedClient: any | null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function resolvePrincipal(): Promise<Principal | null> {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (session?.user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, email")
      .eq("id", session.user.id)
      .maybeSingle()

    return {
      userId: session.user.id,
      email: profile?.email || session.user.email || "",
      // Role comes from public.profiles, never user_metadata: metadata is
      // user-writable, so trusting it would allow self-promotion to admin.
      role: toUserRole(profile?.role) as PrincipalRole,
      isDemo: false,
      isPersistable: true,
      privilegedClient: null,
    }
  }

  // Demo cookie session. Only reachable when ALLOW_INSECURE_DEV_AUTH is set;
  // the middleware refuses to create these cookies otherwise.
  const { cookies } = await import("next/headers")
  const jar = await cookies()
  const demoRole = jar.get(DEMO_ROLE_COOKIE)?.value
  const demoEmail = jar.get(DEMO_EMAIL_COOKIE)?.value

  if (!isDemoRole(demoRole)) return null

  const account = findDemoAccountByEmail(demoEmail)
  if (!account || account.role !== demoRole) return null

  return {
    userId: account.profileId,
    email: account.email,
    role: account.role,
    isDemo: true,
    isPersistable: UUID_RE.test(account.profileId),
    // Demo accounts have no auth session, so RLS cannot see their rows. The
    // service-role client stands in for them; authorization happens in
    // `assertCourseAccess` below, which consults the demo seed directly.
    privilegedClient: hasServiceRoleKey() ? createServiceRoleClient() : null,
  }
}

/** The Supabase client to use for this principal's reads. */
export async function clientForPrincipal(principal: Principal) {
  if (principal.privilegedClient) return principal.privilegedClient
  return createClient()
}

/**
 * Courses a demo account is enrolled in (student) or teaches (teacher).
 *
 * Declared in the demo seed, which is what the README documents. Returns `null`
 * for admin, meaning "every course".
 */
export function demoCourseCodes(principal: Principal): string[] | null {
  if (principal.role === "admin") return null

  const email = principal.email.toLowerCase()

  if (principal.role === "teacher") {
    const teacher = DEMO_TEACHERS.find((candidate) => candidate.email.toLowerCase() === email)
    return teacher?.courseCodes ?? []
  }

  const student = DEMO_STUDENTS.find((candidate) => candidate.email.toLowerCase() === email)
  return student?.courseCodes ?? []
}

/**
 * May this principal read this course?
 *
 * Accepts either a course code or a course UUID, because demo seed data uses
 * codes while Supabase rows use UUIDs. Returns the course row on success so
 * callers do not have to look it up twice.
 */
export async function assertCourseAccess(
  principal: Principal,
  courseIdOrCode: string,
): Promise<{ id: string; code: string; title: string } | null> {
  const supabase = await clientForPrincipal(principal)
  const isUuid = UUID_RE.test(courseIdOrCode)

  const { data: course } = await supabase
    .from("courses")
    .select("id, code, title, teacher_id")
    .eq(isUuid ? "id" : "code", isUuid ? courseIdOrCode : courseIdOrCode.toUpperCase())
    .maybeSingle()

  if (!course) return null
  if (principal.role === "admin") return course

  if (principal.isDemo) {
    const codes = demoCourseCodes(principal)
    if (codes === null) return course
    return codes.includes(course.code) ? course : null
  }

  if (principal.role === "teacher") {
    return course.teacher_id === principal.userId ? course : null
  }

  const { data: enrollment } = await supabase
    .from("course_enrollments")
    .select("course_id")
    .eq("course_id", course.id)
    .eq("student_id", principal.userId)
    .maybeSingle()

  return enrollment ? course : null
}
