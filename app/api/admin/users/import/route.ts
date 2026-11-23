import { NextResponse } from "next/server"

import { requireAdminUser } from "@/lib/server/admin-auth"
import { logAuditEvent } from "@/lib/server/audit-log"
import { createServiceRoleClient, hasServiceRoleKey } from "@/lib/supabase/admin"
import { parseCsv, toRecord } from "@/lib/server/csv"
import {
  ALLOWED_ROLES,
  createManagedUser,
  generatePassword,
  isManagedRole,
  type ManagedRole,
} from "@/lib/server/admin-users"
import { isUniversityEmail } from "@/lib/email-validation"

/**
 * Import accounts from CSV.
 *
 * Two-phase by design: `dryRun=1` validates the file and returns per-row
 * statuses without touching the database, so the dialog can show exactly what
 * will happen. Only the confirmed call creates users.
 *
 * Imports are create-only. Re-uploading a file must never silently change an
 * existing person's role, so matching emails are reported as `existing` and
 * skipped — an administrator can still edit them individually.
 */

const MAX_BYTES = 2 * 1024 * 1024
const MAX_ROWS = 1000

type RowStatus = "ready" | "invalid" | "existing" | "created" | "failed"

type ImportRow = {
  line: number
  email: string
  full_name: string
  role: ManagedRole | string
  status: RowStatus
  message?: string
}

export async function POST(req: Request) {
  const admin = await requireAdminUser()
  if (!admin.user || !admin.isAdmin) {
    return NextResponse.json({ error: "Only an administrator may import accounts" }, { status: 403 })
  }
  if (!hasServiceRoleKey()) {
    return NextResponse.json({ error: "Service role key is not configured" }, { status: 503 })
  }

  const form = await req.formData().catch(() => null)
  const file = form?.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Attach a CSV file" }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "That file is larger than 2 MB" }, { status: 413 })
  }

  const dryRun = String(form?.get("dryRun") ?? "") === "1"
  const confirmAdmins = String(form?.get("confirmAdmins") ?? "") === "1"
  const defaultRoleValue = String(form?.get("defaultRole") ?? "student").trim()
  const defaultRole: ManagedRole = isManagedRole(defaultRoleValue) ? defaultRoleValue : "student"

  const table = parseCsv(await file.text(), MAX_ROWS + 1)
  if (table.rows.length > MAX_ROWS) {
    return NextResponse.json({ error: `Limit the file to ${MAX_ROWS} rows` }, { status: 400 })
  }
  if (!table.headers.includes("email")) {
    return NextResponse.json({ error: "The CSV needs an email column" }, { status: 400 })
  }

  const serviceClient = createServiceRoleClient()

  // Pre-fetch which addresses already exist so the preview can tell "already has
  // an account" apart from "this row is malformed" before anything is created.
  const candidateEmails = table.rows
    .map((cells) => toRecord(table.headers, cells).email.toLowerCase())
    .filter((email) => email.includes("@"))

  const existingEmails = new Set<string>()
  if (candidateEmails.length > 0) {
    const { data: existing } = await serviceClient
      .from("profiles")
      .select("email")
      .in("email", candidateEmails.slice(0, MAX_ROWS))
    for (const row of existing ?? []) {
      if (row.email) existingEmails.add(String(row.email).toLowerCase())
    }
  }

  const seen = new Set<string>()
  const rows: ImportRow[] = table.rows.map((cells, index) => {
    const record = toRecord(table.headers, cells)
    const email = record.email.toLowerCase()
    const roleValue = (record.role || defaultRole).toLowerCase()
    const line = index + 2

    const base: ImportRow = {
      line,
      email,
      full_name: record.full_name || record.name || "",
      role: roleValue,
      status: "ready",
    }

    if (!email) return { ...base, status: "invalid", message: "Missing email address" }
    if (!isUniversityEmail(email)) {
      return { ...base, status: "invalid", message: "Not a university address (@mfu.ac.th or a subdomain)" }
    }
    if (seen.has(email)) return { ...base, status: "invalid", message: "Duplicate row in this file" }
    seen.add(email)
    if (!isManagedRole(roleValue)) {
      return { ...base, status: "invalid", message: `Role must be one of: ${ALLOWED_ROLES.join(", ")}` }
    }
    if (existingEmails.has(email)) {
      return { ...base, status: "existing", message: "Already has an account — skipped" }
    }
    return base
  })

  const readyCount = rows.filter((row) => row.status === "ready").length
  const adminCount = rows.filter((row) => row.status === "ready" && row.role === "admin").length

  const summary = {
    total: rows.length,
    ready: readyCount,
    invalid: rows.filter((row) => row.status === "invalid").length,
    existing: rows.filter((row) => row.status === "existing").length,
    admins: adminCount,
    created: 0,
    failed: 0,
  }

  if (dryRun) {
    return NextResponse.json({ dryRun: true, summary, rows })
  }

  // Confirmation is required only when administrators would actually be created.
  // A dry run must still succeed so the dialog can show the rows and the
  // checkbox that confirms them.
  if (adminCount > 0 && !confirmAdmins) {
    return NextResponse.json(
      {
        error: `This file creates ${adminCount} administrator${adminCount === 1 ? "" : "s"}. Confirm to continue.`,
        requiresAdminConfirmation: true,
        adminCount,
      },
      { status: 400 },
    )
  }


  // Sequential on purpose: a burst of parallel auth user creations trips Supabase
  // auth rate limits and would make failures depend on row order.
  const credentials: Array<{ email: string; password: string }> = []
  for (const row of rows) {
    if (row.status !== "ready") continue
    const password = generatePassword()
    const result = await createManagedUser({
      email: row.email,
      fullName: row.full_name,
      role: row.role as ManagedRole,
      password,
    })

    if (result.ok) {
      row.status = "created"
      row.message = undefined
      credentials.push({ email: row.email, password })
      summary.created += 1
    } else {
      row.status = "failed"
      row.message = result.error
      summary.failed += 1
    }
  }

  await logAuditEvent({
    supabase: admin.supabase as any,
    actorId: admin.user.id,
    action: "admin.users_imported",
    resourceType: "profile",
    metadata: {
      total: summary.total,
      created: summary.created,
      existing: summary.existing,
      invalid: summary.invalid,
      failed: summary.failed,
      admins: summary.admins,
    },
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  })

  return NextResponse.json({ dryRun: false, summary, rows, credentials })
}
