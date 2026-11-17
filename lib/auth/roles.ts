import type { SupabaseClient } from "@supabase/supabase-js"
import type { UserRole } from "@/lib/types"

/**
 * Resolve a user's role from the authoritative source: public.profiles.
 *
 * Never read the role from auth metadata. `user_metadata` is writable by the
 * signed-in user, so trusting it lets any account promote itself with
 * `supabase.auth.updateUser({ data: { role: "admin" } })`. `app_metadata` is
 * server-only but still not what the database enforces, so profiles wins.
 *
 * Falls back to the lowest-privilege role ("student") when the row is missing
 * or the value is unrecognised — failing closed rather than open.
 */
export async function resolveRoleFromProfile(
  supabase: SupabaseClient,
  userId: string | null | undefined,
): Promise<UserRole> {
  if (!userId) return "student"

  try {
    const { data } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle()
    return toUserRole(data?.role)
  } catch {
    return "student"
  }
}

export function toUserRole(value: unknown): UserRole {
  return value === "admin" ? "admin" : value === "teacher" ? "teacher" : "student"
}

/**
 * The set of emails permitted to hold the admin role, from ADMIN_EMAILS.
 * Used only when creating or checking an account, never as a runtime role
 * source — the profile row remains authoritative.
 */
export function adminEmailAllowlist(): Set<string> {
  return new Set(
    String(process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  )
}

export function isAllowlistedAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  return adminEmailAllowlist().has(email.trim().toLowerCase())
}
