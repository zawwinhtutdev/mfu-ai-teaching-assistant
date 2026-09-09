import { createServiceRoleClient } from "@/lib/supabase/admin"

type TrackApiErrorInput = {
  route: string
  error: unknown
  actorId?: string | null
  metadata?: Record<string, unknown>
}

function stringifyError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack || null,
    }
  }

  if (typeof error === "string") {
    return {
      name: "Error",
      message: error,
      stack: null,
    }
  }

  try {
    return {
      name: "Error",
      message: JSON.stringify(error),
      stack: null,
    }
  } catch {
    return {
      name: "Error",
      message: "Unknown error",
      stack: null,
    }
  }
}

export async function trackApiError(input: TrackApiErrorInput) {
  const normalized = stringifyError(input.error)
  const payload = {
    route: input.route,
    actorId: input.actorId || null,
    ...normalized,
    metadata: input.metadata || {},
    at: new Date().toISOString(),
  }

  console.error("[api_error]", JSON.stringify(payload))

  try {
    const admin = createServiceRoleClient()
    await admin.from("audit_logs").insert({
      actor_id: input.actorId || null,
      action: "api.error",
      resource_type: "api_route",
      resource_id: input.route,
      metadata: {
        name: normalized.name,
        message: normalized.message,
        stack: normalized.stack,
        ...input.metadata,
      },
    })
  } catch (auditError) {
    const audit = stringifyError(auditError)
    console.error("[api_error_audit_insert_failed]", JSON.stringify({
      route: input.route,
      name: audit.name,
      message: audit.message,
      at: new Date().toISOString(),
    }))
  }
}

