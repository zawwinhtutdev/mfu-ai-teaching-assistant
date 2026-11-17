/**
 * Email → role policy, mirrored from the database.
 *
 * The authoritative implementation is `public.role_for_email()` in
 * supabase/migrations/20261231000100_role_from_email.sql. This copy exists only
 * so the UI can *preview* the outcome before signup; it must never be used to
 * decide access. Anything security-relevant reads `public.profiles.role`.
 *
 * MFU address formats:
 *   student  <studentID>@lamduan.mfu.ac.th
 *   teacher  <firstname.last>@mfu.ac.th
 *   admin    an explicit allowlist (ADMIN_EMAILS, default admin@mfu.ac.th)
 */

export type DerivableRole = "student" | "teacher" | "admin"

export const STUDENT_DOMAIN = "lamduan.mfu.ac.th"
export const TEACHER_DOMAIN = "mfu.ac.th"

function adminAllowlist(): string[] {
  const raw = (process.env.ADMIN_EMAILS || "").trim()
  const list = (raw || "admin@mfu.ac.th")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
  return list
}

/**
 * Returns the role an address will be assigned at signup, or null when the
 * address is not a recognised university format (signup is then rejected).
 */
export function roleForEmail(email: string): DerivableRole | null {
  const normalized = email.trim().toLowerCase()
  const at = normalized.lastIndexOf("@")
  if (at <= 0 || at === normalized.length - 1) return null

  const localPart = normalized.slice(0, at)
  const domain = normalized.slice(at + 1)

  if (adminAllowlist().includes(normalized)) return "admin"
  if (domain === STUDENT_DOMAIN) return "student"
  if (domain === TEACHER_DOMAIN) return "teacher"

  return null
}

export function describeRoleForEmail(email: string): string {
  const role = roleForEmail(email)

  switch (role) {
    case "admin":
      return "This address is on the administrator allowlist. You will sign in to the Admin Console."
    case "teacher":
      return "This is a staff address, so your account will be created with the Teacher role."
    case "student":
      return "This is a student address, so your account will be created with the Student role."
    default:
      return `Use your university address: ${STUDENT_DOMAIN} for students, ${TEACHER_DOMAIN} for staff.`
  }
}
