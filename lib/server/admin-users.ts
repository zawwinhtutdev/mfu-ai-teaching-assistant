import { randomBytes } from "node:crypto"

import { isUniversityEmail } from "@/lib/email-validation"
import { createServiceRoleClient } from "@/lib/supabase/admin"

/**
 * Account creation shared by the single-account dialog and CSV import.
 *
 * Both paths must behave identically: a confirmed auth user is created first so
 * the person can actually sign in, `handle_new_user` inserts the profile from
 * the domain rule, and the requested role is applied afterwards. Keeping one
 * implementation means an import row can never quietly skip a step that the
 * dialog performs.
 */

export type ManagedRole = "student" | "teacher" | "admin"

export const ALLOWED_ROLES: ManagedRole[] = ["student", "teacher", "admin"]

export function isManagedRole(value: string): value is ManagedRole {
  return (ALLOWED_ROLES as string[]).includes(value)
}

/**
 * Generate a password that satisfies the auth policy.
 *
 * These are handed to the administrator once, in the import result, because a
 * self-hosted stack may not have SMTP configured for invite emails.
 */
export function generatePassword() {
  return `${randomBytes(9).toString("base64url")}9aA!`
}

export type CreateManagedUserInput = {
  email: string
  fullName?: string | null
  role: ManagedRole
  password?: string
}

export type CreateManagedUserResult =
  | {
      ok: true
      user: {
        id: string
        email: string | null
        full_name: string | null
        role: string
        created_at?: string
        updated_at?: string
      }
    }
  | { ok: false; status: number; error: string }

export async function createManagedUser(input: CreateManagedUserInput): Promise<CreateManagedUserResult> {
  const email = input.email.trim().toLowerCase()
  const fullName = (input.fullName ?? "").trim()
  const role = input.role

  if (!isUniversityEmail(email)) {
    return {
      ok: false,
      status: 400,
      error: "Use a university address (@mfu.ac.th or a subdomain). External addresses are blocked by the signup policy.",
    }
  }
  if (!isManagedRole(role)) {
    return { ok: false, status: 400, error: `role must be one of: ${ALLOWED_ROLES.join(", ")}` }
  }

  const password = input.password && input.password.length >= 8 ? input.password : generatePassword()
  const serviceClient = createServiceRoleClient()

  const { data: created, error: createError } = await serviceClient.auth.admin.createUser({
    email,
    password,
    // Confirmed up front: the admin is vouching for this person, and a
    // confirmation email would require SMTP a self-hosted stack may not have.
    email_confirm: true,
    user_metadata: { full_name: fullName || email.split("@")[0] },
  })

  if (createError || !created?.user) {
    const message = createError?.message || "Could not create the account"
    // A duplicate is a user-facing outcome, not a server fault. Supabase says
    // "A user with this email address has already been registered".
    if (createError?.code === "email_exists" || /already (?:been )?registered|already exists|duplicate/i.test(message)) {
      return { ok: false, status: 409, error: `${email} already has an account` }
    }
    return { ok: false, status: 500, error: message }
  }

  // `handle_new_user` already inserted the profile from the domain rule. Apply
  // the requested role and name now.
  const { data: profile, error: profileError } = await serviceClient
    .from("profiles")
    .update({ role, full_name: fullName || null, updated_at: new Date().toISOString() })
    .eq("id", created.user.id)
    .select("id, email, full_name, role, created_at, updated_at")
    .maybeSingle()

  if (profileError) {
    // Leaving an auth user with no usable role is worse than a failed create,
    // so remove the half-made account.
    await serviceClient.auth.admin.deleteUser(created.user.id)
    return { ok: false, status: 500, error: profileError.message }
  }

  return {
    ok: true,
    user: profile as {
      id: string
      email: string | null
      full_name: string | null
      role: string
      created_at?: string
      updated_at?: string
    },
  }
}
