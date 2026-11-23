import { NextResponse } from "next/server"
import { createServiceRoleClient, hasServiceRoleKey, DEMO_USERS } from "@/lib/supabase/admin"
import { requireAdminUser } from "@/lib/server/admin-auth"
import { logAuditEvent } from "@/lib/server/audit-log"
import { ALLOWED_ROLES, createManagedUser, isManagedRole, type ManagedRole } from "@/lib/server/admin-users"

/**
 * Create an account with a chosen role.
 *
 * Only an authenticated admin may call this, and the role is set directly rather
 * than being derived from the email domain. Domain derivation is the right rule
 * for self-service signup — nobody should become an admin by registering — but
 * an operator adding a colleague is an explicit, audited action.
 *
 * Creation itself lives in `createManagedUser` so the CSV importer and this
 * single-account path cannot drift apart.
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
    const role = typeof body?.role === "string" ? body.role.trim() : ""
    const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : ""

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "A valid email address is required" }, { status: 400 })
    }
    if (!isManagedRole(role)) {
      return NextResponse.json(
        { error: `role must be one of: ${ALLOWED_ROLES.join(", ")}` },
        { status: 400 },
      )
    }

    const result = await createManagedUser({
      email,
      fullName,
      role: role as ManagedRole,
      password: typeof body?.password === "string" ? body.password : undefined,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    await logAuditEvent({
      supabase: admin.supabase as any,
      actorId: admin.user.id,
      action: "admin.user_created",
      resourceType: "profile",
      resourceId: result.user.id,
      metadata: { email, role },
      ipAddress: req.headers.get("x-forwarded-for"),
      userAgent: req.headers.get("user-agent"),
    })

    return NextResponse.json({ user: result.user })
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

export async function DELETE(req: Request) {
  try {
    const admin = await requireAdminUser()
    if (!admin.user || !admin.isAdmin) {
      return NextResponse.json({ error: "Only an administrator may remove accounts" }, { status: 403 })
    }
    if (!hasServiceRoleKey()) {
      return NextResponse.json({ error: "Service role key is not configured" }, { status: 503 })
    }

    const body = await req.json().catch(() => ({}))
    const userId = String(body?.userId || "").trim()
    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 })
    }

    if (userId === admin.user.id) {
      return NextResponse.json({ error: "You cannot remove your own account" }, { status: 400 })
    }

    const serviceClient = createServiceRoleClient()
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, email, role")
      .eq("id", userId)
      .maybeSingle()

    if (!profile) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 })
    }

    if (profile.role === "admin") {
      const { count } = await serviceClient
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin")
      if ((count ?? 0) <= 1) {
        return NextResponse.json(
          { error: "At least one administrator must remain" },
          { status: 400 },
        )
      }
    }

    const { error: authError } = await serviceClient.auth.admin.deleteUser(userId)
    // A profile seeded without an auth user has nothing to delete in GoTrue;
    // anything else is a real failure and must not be reported as success.
    if (authError && !/not\s*found|does not exist/i.test(authError.message)) {
      return NextResponse.json({ error: authError.message }, { status: 500 })
    }

    // Defensive: if the auth user was already gone, the profile may still exist.
    await serviceClient.from("profiles").delete().eq("id", userId)

    await logAuditEvent({
      supabase: admin.supabase as any,
      actorId: admin.user.id,
      action: "admin.user_deleted",
      resourceType: "profile",
      resourceId: userId,
      metadata: { email: profile.email, role: profile.role },
      ipAddress: req.headers.get("x-forwarded-for"),
      userAgent: req.headers.get("user-agent"),
    })

    return NextResponse.json({ deleted: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to remove the account" }, { status: 500 })
  }
}
