"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Bell, RefreshCw, CheckCircle2, XCircle, Clock, Activity } from "lucide-react"

type NotificationJob = {
  id: string
  user_id: string
  course_id: string | null
  channel: string
  template: string
  status: string
  scheduled_for: string
  attempt_count: number
  last_error: string | null
  created_at: string
}

export default function NotificationsPage() {
  const [jobs, setJobs] = useState<NotificationJob[]>([])
  const [statusFilter, setStatusFilter] = useState("")
  const [loading, setLoading] = useState(true)

  const loadJobs = useCallback(async () => {
    setLoading(true)
    try {
      const sp = statusFilter ? `&status=${statusFilter}` : ""
      const res = await fetch(`/api/admin/notifications?limit=50${sp}`)
      const data = await res.json()
      if (res.ok) setJobs(Array.isArray(data?.jobs) ? data.jobs : [])
    } catch {}
    setLoading(false)
  }, [statusFilter])

  useEffect(() => { loadJobs() }, [loadJobs])

  const statusBadge = (status: string) => {
    switch (status) {
      case "sent": return <Badge variant="default" className="bg-emerald-600"><CheckCircle2 className="mr-1 h-3 w-3" /> Sent</Badge>
      case "failed": return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" /> Failed</Badge>
      case "queued": return <Badge variant="secondary"><Clock className="mr-1 h-3 w-3" /> Queued</Badge>
      case "processing": return <Badge variant="outline" className="border-blue-400 text-blue-600"><Activity className="mr-1 h-3 w-3" /> Processing</Badge>
      case "canceled": return <Badge variant="outline" className="text-muted-foreground"><XCircle className="mr-1 h-3 w-3" /> Canceled</Badge>
      default: return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div>
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#00001b", margin: "0 0 4px" }}>
          Notifications
        </h1>
        <p style={{ fontSize: "14px", color: "#888", margin: 0 }}>
          Monitor notification delivery across email, LINE, and push channels
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" /> Notification Jobs
              </CardTitle>
              <CardDescription>
                Monitor pending, sent, and failed notification deliveries across all channels.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadJobs}>
              <RefreshCw className="mr-1.5 h-3 w-3" /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select
            value={statusFilter || "__all__"}
            onValueChange={(v) => setStatusFilter(v === "__all__" ? "" : v)}
          >
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All statuses</SelectItem>
              <SelectItem value="queued">Queued</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="canceled">Canceled</SelectItem>
            </SelectContent>
          </Select>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No notification jobs found.</p>
          ) : (
            <div className="space-y-2">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/20"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{job.template}</p>
                      <Badge variant="outline" className="text-[10px]">{job.channel}</Badge>
                      {statusBadge(job.status)}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      User: {job.user_id.slice(0, 12)}…
                      {job.course_id ? ` · Course: ${job.course_id.slice(0, 12)}…` : ""}
                      {` · Attempts: ${job.attempt_count}`}
                    </p>
                    {job.last_error && (
                      <p className="mt-0.5 text-[10px] text-destructive">{job.last_error}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground/70">
                      Scheduled: {new Date(job.scheduled_for).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
