"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FileText, Search, RefreshCw, ChevronDown, ChevronUp } from "lucide-react"

type AuditLog = {
  id: string
  actor_id: string | null
  action: string
  resource_type: string
  resource_id: string | null
  metadata: Record<string, any>
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [filter, setFilter] = useState("")
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const loadLogs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/audit-logs?limit=200")
      const data = await res.json()
      if (res.ok) setLogs(Array.isArray(data?.logs) ? data.logs : [])
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { loadLogs() }, [loadLogs])

  const filtered = useMemo(() => {
    if (!filter) return logs
    const q = filter.toLowerCase()
    return logs.filter(
      (l) =>
        l.action.toLowerCase().includes(q) ||
        l.resource_type.toLowerCase().includes(q) ||
        (l.resource_id || "").toLowerCase().includes(q),
    )
  }, [logs, filter])

  const uniqueActions = useMemo(() => [...new Set(logs.map((l) => l.action))].sort(), [logs])

  return (
    <div>
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#00001b", margin: "0 0 4px" }}>
          Audit Logs
        </h1>
        <p style={{ fontSize: "14px", color: "#888", margin: 0 }}>
          Track who accessed what data, when — for PDPA/GDPR compliance
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" /> Activity Log
              </CardTitle>
              <CardDescription>All administrative actions and system events.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadLogs}>
              <RefreshCw className="mr-1.5 h-3 w-3" /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Filter by action, resource type, or ID..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="pl-9"
              />
            </div>
            {uniqueActions.length > 0 && (
              <Select value={filter || "__all__"} onValueChange={(v) => setFilter(v === "__all__" ? "" : v)}>
                <SelectTrigger className="w-full sm:w-[220px]">
                  <SelectValue placeholder="Filter by action..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All actions</SelectItem>
                  {uniqueActions.map((action) => (
                    <SelectItem key={action} value={action}>{action}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No audit logs found.</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Showing {filtered.length} of {logs.length} logs
              </p>
              <div className="space-y-2">
                {filtered.map((log) => {
                  const isExpanded = expandedId === log.id
                  return (
                    <div key={log.id} className="rounded-lg border p-3 transition-colors hover:bg-muted/20">
                      <button
                        className="flex w-full items-start justify-between text-left"
                        onClick={() => setExpandedId(isExpanded ? null : log.id)}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{log.action}</p>
                            <Badge variant="outline" className="text-[10px]">{log.resource_type}</Badge>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {new Date(log.created_at).toLocaleString()}
                            {log.resource_id ? ` · ${log.resource_id.slice(0, 8)}…` : ""}
                          </p>
                        </div>
                        {isExpanded ? <ChevronUp className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />}
                      </button>
                      {isExpanded && (
                        <div className="mt-3 space-y-1 rounded-md bg-muted/40 p-3 text-xs font-mono">
                          <p><span className="text-muted-foreground">Actor:</span> {log.actor_id || "system"}</p>
                          <p><span className="text-muted-foreground">Resource:</span> {log.resource_type} / {log.resource_id || "—"}</p>
                          <p><span className="text-muted-foreground">IP:</span> {log.ip_address || "—"}</p>
                          <p><span className="text-muted-foreground">User Agent:</span> {log.user_agent ? log.user_agent.slice(0, 80) + "…" : "—"}</p>
                          {Object.keys(log.metadata || {}).length > 0 && (
                            <div className="mt-2">
                              <p className="text-muted-foreground">Metadata:</p>
                              <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-[11px]">
                                {JSON.stringify(log.metadata, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
