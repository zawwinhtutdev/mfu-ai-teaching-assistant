import { NextResponse } from "next/server"
import { createServiceRoleClient, hasServiceRoleKey, DEMO_USERS } from "@/lib/supabase/admin"
import { requireAdminUser } from "@/lib/server/admin-auth"
import { logAuditEvent } from "@/lib/server/audit-log"

const ALLOWED_ROLES = new Set(["student", "teacher", "admin"])

/**
 * Create an account with a chosen role.
 *
 * Only an authenticated admin may call this, and the role is set directly rather
 * than being derived from the email domain. Domain derivation is the right rule
 * for self-service signup — nobody should become an admin by registering — but
 * an operator adding a colleague is an explicit, audited action.
 *
 * The auth user is created first (so they can actually sign in), confirmed
 * immediately, then the profile row gets the requested role. `handle_new_user`
 * creates the profile from the domain; this updates it afterwards, which is why
 * the role guard had to allow service-role writes.
 */
export async function POST(req: Request) {
  try {
    const admin = await requireAdminUser()
    if (!admin.user || !admin.isAdmin) {
      return NextResponse.json({ error: "Only an administrator may create accounts" }, { status: 403 })
    }

    if (!hasServiceRoleKey()) {
      return NextResponse.json({ error: "Service role key is not configured" }, { status: 503 })
    }

    let body: any
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""
    const password = typeof body?.password === "string" ? body.password : ""
    const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : ""
    const role = typeof body?.role === "string" ? body.role.trim() : ""

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "A valid email address is required" }, { status: 400 })
    }

    // Accounts must use a university address. The database enforces this with a
    // trigger on auth.users, and there is no safe way to bypass it for a single
    // privileged call: GoTrue uses the same connection for public signup, so a
    // role-based exception also opened public registration to any domain.
    // Checking here turns that into an actionable message instead of a 500.
    const domain = email.slice(email.lastIndexOf("@") + 1)
    if (domain !== "mfu.ac.th" && !domain.endsWith(".mfu.ac.th")) {
      return NextResponse.json(
        {
          error:
            "Use a university address (@mfu.ac.th or a subdomain). External addresses are blocked by the signup policy.",
        },
        { status: 400 },
      )
    }
    if (!ALLOWED_ROLES.has(role)) {
      return NextResponse.json(
        { error: `role must be one of: ${Array.from(ALLOWED_ROLES).join(", ")}` },
        { status: 400 },
      )
    }
    // A short password is the most common way this fails in practice, so check
    // it here rather than surfacing a GoTrue validation error.
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
    }

    const serviceClient = createServiceRoleClient()

    const { data: created, error: createError } = await serviceClient.auth.admin.createUser({
      email,
      password,
      // Confirmed up front: the admin is vouching for this person, and a
      // confirmation email would require SMTP that a self-hosted stack may not
      // have configured.
      email_confirm: true,
      user_metadata: { full_name: fullName || email.split("@")[0] },
    })

    if (createError || !created?.user) {
      const message = createError?.message || "Could not create the account"
      // A duplicate is a user-facing outcome, not a server fault. Supabase says
      // "A user with this email address has already been registered", which the
      // earlier pattern missed — it only allowed "already registered" with no
      // intervening words.
      if (createError?.code === "email_exists" || /already (?:been )?registered|already exists|duplicate/i.test(message)) {
        return NextResponse.json({ error: `${email} already has an account` }, { status: 409 })
      }
      return NextResponse.json({ error: message }, { status: 500 })
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
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    await logAuditEvent({
      supabase: admin.supabase as any,
      actorId: admin.user.id,
      action: "admin.user_created",
      resourceType: "profile",
      resourceId: created.user.id,
      metadata: { email, role },
      ipAddress: req.headers.get("x-forwarded-for"),
      userAgent: req.headers.get("user-agent"),
    })

    return NextResponse.json({ user: profile })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to create the account" }, { status: 500 })
  }
}

export async function GET() {
  try {
    const admin = await requireAdminUser()
    if (!admin.user || !admin.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!hasServiceRoleKey()) {
      return NextResponse.json({ users: DEMO_USERS })
    }

    const serviceClient = createServiceRoleClient()
    const { data, error } = await serviceClient
      .from("profiles")
      .select("id, email, full_name, role, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(300)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ users: data || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to load users" }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const admin = await requireAdminUser()
    if (!admin.user || !admin.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const userId = String(body?.userId || "").trim()
    const role = String(body?.role || "").trim()

    if (!userId || !ALLOWED_ROLES.has(role)) {
      return NextResponse.json({ error: "Invalid userId or role" }, { status: 400 })
    }

    if (!hasServiceRoleKey()) {
      return NextResponse.json({ user: { id: userId, role, email: "demo@mfu.ac.th", full_name: "Demo User", created_at: new Date().toISOString() } })
    }

    const serviceClient = createServiceRoleClient()
    const { data, error } = await serviceClient
      .from("profiles")
      .update({ role })
      .eq("id", userId)
      .select("id, email, full_name, role, created_at, updated_at")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await logAuditEvent({
      supabase: admin.supabase as any,
      actorId: admin.user.id,
      action: "admin.user_role_updated",
      resourceType: "profile",
      resourceId: userId,
      metadata: { role },
      ipAddress: req.headers.get("x-forwarded-for"),
      userAgent: req.headers.get("user-agent"),
    })

    return NextResponse.json({ user: data })
  } catch (error: any) {
    // A rejected role change is an authorization outcome, not a server fault.
    // The database raises insufficient_privilege (42501) from the role guard;
    // surfacing that as 403 keeps it out of the 5xx error budget and gives the
    // UI an actionable message.
    const code = error?.code
    if (code === "42501" || /Only administrators may change a user role/i.test(error?.message || "")) {
      return NextResponse.json(
        { error: error?.message || "Only administrators may change a user role" },
        { status: 403 },
      )
    }
    return NextResponse.json({ error: error?.message || "Failed to update role" }, { status: 500 })
  }
}
