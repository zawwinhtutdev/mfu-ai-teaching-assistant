import { NextResponse } from "next/server"

import { requireAdminUser } from "@/lib/server/admin-auth"
import { logAuditEvent } from "@/lib/server/audit-log"
import { createServiceRoleClient, DEMO_USERS, hasServiceRoleKey } from "@/lib/supabase/admin"
import { serializeCsv } from "@/lib/server/csv"
import { ALLOWED_ROLES } from "@/lib/server/admin-users"

/**
 * Export accounts as CSV.
 *
 * Defaults to the two populations the console manages most often — students and
 * teachers — in one file, because splitting them across tabs means two exports
 * and a manual merge. `?roles=all` adds administrators, and a single role can be
 * requested for a filtered view.
 *
 * The file deliberately contains only what an operator needs to reconcile a
 * roster: email, name, role and joined date. No ids, hashes or tokens.
 */

const DEFAULT_ROLES = ["student", "teacher"]

function parseRoles(value: string | null) {
  if (!value || !value.trim()) return DEFAULT_ROLES
  const requested = value
    .split(",")
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean)

  if (requested.includes("all")) return [...ALLOWED_ROLES]
  const valid = requested.filter((role) => (ALLOWED_ROLES as string[]).includes(role))
  return valid.length > 0 ? Array.from(new Set(valid)) : DEFAULT_ROLES
}

export async function GET(req: Request) {
  const admin = await requireAdminUser()
  if (!admin.user || !admin.isAdmin) {
    return NextResponse.json({ error: "Only an administrator may export accounts" }, { status: 403 })
  }

  const roles = parseRoles(new URL(req.url).searchParams.get("roles"))

  let rows: Array<{ email: string | null; full_name: string | null; role: string; created_at: string | null }> = []

  if (!hasServiceRoleKey()) {
    rows = DEMO_USERS.filter((user) => roles.includes(user.role)).map((user) => ({
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      created_at: user.created_at,
    }))
  } else {
    const supabase = createServiceRoleClient()
    const { data, error } = await supabase
      .from("profiles")
      .select("email, full_name, role, created_at")
      // Stable order: role groups the file, then oldest-first by join date so an
      // operator can diff two exports without the rows moving around.
      .in("role", roles)
      .order("role", { ascending: true })
      .order("created_at", { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    rows = data ?? []
  }

  const csv = serializeCsv(
    ["email", "full_name", "role", "joined_at"],
    rows.map((row) => [
      row.email ?? "",
      row.full_name ?? "",
      row.role,
      // Date only: the roster question is "when did they join", not a timestamp.
      (row.created_at ?? "").slice(0, 10),
    ]),
  )

  await logAuditEvent({
    supabase: admin.supabase as any,
    actorId: admin.user.id,
    action: "admin.users_exported",
    resourceType: "profile",
    metadata: { roles, count: rows.length },
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  })

  const filename = `mfu-users-${roles.join("-")}-${new Date().toISOString().slice(0, 10)}.csv`

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}
