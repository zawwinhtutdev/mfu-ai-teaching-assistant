type SupabaseLikeClient = {
  from: (table: string) => any
}

export async function logAuditEvent(params: {
  supabase: SupabaseLikeClient
  actorId: string | null | undefined
  action: string
  resourceType: string
  resourceId?: string | null
  metadata?: Record<string, any>
  ipAddress?: string | null
  userAgent?: string | null
}) {
  if (!params.actorId) {
    return
  }

  const { error } = await params.supabase.from("audit_logs").insert({
    actor_id: params.actorId,
    action: params.action,
    resource_type: params.resourceType,
    resource_id: params.resourceId || null,
    metadata: params.metadata || {},
    ip_address: params.ipAddress || null,
    user_agent: params.userAgent || null,
  })

  if (error) {
    console.error("Failed to write audit log:", error)
  }
}
