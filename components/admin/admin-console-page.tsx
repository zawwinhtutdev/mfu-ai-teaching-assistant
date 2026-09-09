"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Users,
  Shield,
  FileText,
  BarChart3,
  Bell,
  ShieldCheck,
  RefreshCw,
  Search,
  GraduationCap,
  BookOpen,
  MessageSquare,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react"

/* ─── Types ─── */

type AdminUser = {
  id: string
  email: string
  full_name: string | null
  role: "student" | "teacher" | "admin"
  created_at: string
  updated_at?: string
}

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

type SystemPolicy = {
  policy_key: string
  policy_value: Record<string, any>
  updated_by: string | null
  updated_at: string
}

type ConsentRecord = {
  id: string
  user_id: string
  consent_type: string
  is_granted: boolean
  source: string | null
  granted_at: string | null
  revoked_at: string | null
  created_at: string
  updated_at: string
}

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

type DashboardStats = {
  totalUsers: number
  roleCounts: { student: number; teacher: number; admin: number }
  totalCourses: number
  totalEnrollments: number
  totalConversations: number
  totalAuditLogs: number
  notifications: { queued: number; processing: number; sent: number; failed: number; canceled: number }
  consents: { total: number; granted: number; revoked: number }
}

/* ─── Stat Card ─── */

function StatCard({
  icon: Icon,
  label,
  value,
  subtitle,
  color,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  subtitle?: string
  color: string
}) {
  return (
    <Card className="relative overflow-hidden">
      <div className={`absolute inset-0 opacity-[0.04] ${color}`} />
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${color} text-white`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold tabular-nums">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground/80">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

/* ─── Main Component ─── */

export function AdminConsolePage() {
  // Data states
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [policies, setPolicies] = useState<SystemPolicy[]>([])
  const [consents, setConsents] = useState<ConsentRecord[]>([])
  const [notifJobs, setNotifJobs] = useState<NotificationJob[]>([])

  // UI states
  const [userSearch, setUserSearch] = useState("")
  const [logActionFilter, setLogActionFilter] = useState("")
  const [notifStatusFilter, setNotifStatusFilter] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null)

  // Loading states
  const [loadingStats, setLoadingStats] = useState(true)
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [loadingLogs, setLoadingLogs] = useState(true)
  const [loadingPolicies, setLoadingPolicies] = useState(true)
  const [loadingConsents, setLoadingConsents] = useState(true)
  const [loadingNotifs, setLoadingNotifs] = useState(true)

  /* ─── Loaders ─── */

  const loadStats = useCallback(async () => {
    setLoadingStats(true)
    try {
      const res = await fetch("/api/admin/stats")
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Failed to load stats")
      setStats(data?.stats || null)
    } catch (err: any) {
      setError(err?.message || "Failed to load stats")
    } finally {
      setLoadingStats(false)
    }
  }, [])

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true)
    try {
      const res = await fetch("/api/admin/users")
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Failed to load users")
      setUsers(Array.isArray(data?.users) ? data.users : [])
    } catch (err: any) {
      setError(err?.message || "Failed to load users")
    } finally {
      setLoadingUsers(false)
    }
  }, [])

  const loadLogs = useCallback(async () => {
    setLoadingLogs(true)
    try {
      const res = await fetch("/api/admin/audit-logs?limit=200")
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Failed to load logs")
      setLogs(Array.isArray(data?.logs) ? data.logs : [])
    } catch (err: any) {
      setError(err?.message || "Failed to load logs")
    } finally {
      setLoadingLogs(false)
    }
  }, [])

  const loadPolicies = useCallback(async () => {
    setLoadingPolicies(true)
    try {
      const res = await fetch("/api/admin/policies")
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Failed to load policies")
      setPolicies(Array.isArray(data?.policies) ? data.policies : [])
    } catch (err: any) {
      setError(err?.message || "Failed to load policies")
    } finally {
      setLoadingPolicies(false)
    }
  }, [])

  const loadConsents = useCallback(async () => {
    setLoadingConsents(true)
    try {
      const res = await fetch("/api/admin/consents")
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Failed to load consents")
      setConsents(Array.isArray(data?.consents) ? data.consents : [])
    } catch (err: any) {
      setError(err?.message || "Failed to load consents")
    } finally {
      setLoadingConsents(false)
    }
  }, [])

  const loadNotifs = useCallback(async () => {
    setLoadingNotifs(true)
    try {
      const statusParam = notifStatusFilter ? `&status=${notifStatusFilter}` : ""
      const res = await fetch(`/api/admin/notifications?limit=50${statusParam}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Failed to load notifications")
      setNotifJobs(Array.isArray(data?.jobs) ? data.jobs : [])
    } catch (err: any) {
      setError(err?.message || "Failed to load notifications")
    } finally {
      setLoadingNotifs(false)
    }
  }, [notifStatusFilter])

  useEffect(() => {
    loadStats()
    loadUsers()
    loadLogs()
    loadPolicies()
    loadConsents()
    loadNotifs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reload notification jobs when filter changes
  useEffect(() => {
    loadNotifs()
  }, [loadNotifs])

  /* ─── Actions ─── */

  const setUserRole = async (userId: string, role: "student" | "teacher" | "admin") => {
    setError(null)
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Failed to update role")
      setUsers((prev) => prev.map((user) => (user.id === userId ? { ...user, role } : user)))
    } catch (err: any) {
      setError(err?.message || "Failed to update role")
    }
  }

  const upsertPolicy = async (policyKey: string, enabled: boolean) => {
    setError(null)
    try {
      const res = await fetch("/api/admin/policies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policyKey, policyValue: { enabled } }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Failed to update policy")
      const policy = data?.policy
      if (!policy) return
      setPolicies((prev) => {
        const idx = prev.findIndex((item) => item.policy_key === policy.policy_key)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = policy
          return next
        }
        return [...prev, policy]
      })
    } catch (err: any) {
      setError(err?.message || "Failed to update policy")
    }
  }

  /* ─── Derived data ─── */

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase()
    if (!q) return users
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        (u.full_name || "").toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q),
    )
  }, [users, userSearch])

  const filteredLogs = useMemo(() => {
    if (!logActionFilter) return logs
    const q = logActionFilter.toLowerCase()
    return logs.filter(
      (l) =>
        l.action.toLowerCase().includes(q) ||
        l.resource_type.toLowerCase().includes(q) ||
        (l.resource_id || "").toLowerCase().includes(q),
    )
  }, [logs, logActionFilter])

  const uniqueLogActions = useMemo(() => {
    return [...new Set(logs.map((l) => l.action))].sort()
  }, [logs])

  const knownPolicyKeys = ["allow_google_sso", "allow_line_notifications", "strict_course_rag"]
  const policyDescriptions: Record<string, string> = {
    allow_google_sso: "Allow users to sign in via Google SSO (OIDC)",
    allow_line_notifications: "Enable LINE OA notification delivery channel",
    strict_course_rag: "Restrict AI answers strictly to uploaded course materials",
  }

  const policyMap = useMemo(() => {
    const map = new Map<string, SystemPolicy>()
    for (const p of policies) map.set(p.policy_key, p)
    return map
  }, [policies])

  const roleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":
        return "destructive"
      case "teacher":
        return "default"
      default:
        return "secondary"
    }
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return <Badge variant="default" className="bg-emerald-600"><CheckCircle2 className="mr-1 h-3 w-3" /> Sent</Badge>
      case "failed":
        return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" /> Failed</Badge>
      case "queued":
        return <Badge variant="secondary"><Clock className="mr-1 h-3 w-3" /> Queued</Badge>
      case "processing":
        return <Badge variant="outline" className="border-blue-400 text-blue-600"><Activity className="mr-1 h-3 w-3" /> Processing</Badge>
      case "canceled":
        return <Badge variant="outline" className="text-muted-foreground"><XCircle className="mr-1 h-3 w-3" /> Canceled</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  /* ─── Render ─── */

  return (
    <div className="container mx-auto flex-1 space-y-6 px-4 py-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Shield className="h-7 w-7 text-primary" />
            Admin Console
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            System overview, user management, audit logs, privacy compliance, and policy controls.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            loadStats()
            loadUsers()
            loadLogs()
            loadPolicies()
            loadConsents()
            loadNotifs()
          }}
          className="shrink-0"
        >
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh All
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
          <button className="ml-auto text-xs underline" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5">
            <Users className="h-3.5 w-3.5" /> Users
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Audit Logs
          </TabsTrigger>
          <TabsTrigger value="privacy" className="gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" /> Privacy
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1.5">
            <Bell className="h-3.5 w-3.5" /> Notifications
          </TabsTrigger>
          <TabsTrigger value="policies" className="gap-1.5">
            <Shield className="h-3.5 w-3.5" /> Policies
          </TabsTrigger>
        </TabsList>

        {/* ─── Overview Tab ─── */}
        <TabsContent value="overview">
          {loadingStats ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-5">
                    <div className="h-16 animate-pulse rounded-md bg-muted" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : stats ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  icon={Users}
                  label="Total Users"
                  value={stats.totalUsers}
                  subtitle={`${stats.roleCounts.student} students · ${stats.roleCounts.teacher} teachers · ${stats.roleCounts.admin} admins`}
                  color="bg-blue-600"
                />
                <StatCard icon={BookOpen} label="Courses" value={stats.totalCourses} color="bg-violet-600" />
                <StatCard
                  icon={GraduationCap}
                  label="Enrollments"
                  value={stats.totalEnrollments}
                  color="bg-emerald-600"
                />
                <StatCard
                  icon={MessageSquare}
                  label="Conversations"
                  value={stats.totalConversations}
                  color="bg-amber-600"
                />
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard icon={FileText} label="Audit Logs" value={stats.totalAuditLogs} color="bg-slate-600" />
                <StatCard
                  icon={Bell}
                  label="Notifications"
                  value={stats.notifications.sent + stats.notifications.queued + stats.notifications.failed}
                  subtitle={`${stats.notifications.sent} sent · ${stats.notifications.failed} failed · ${stats.notifications.queued} queued`}
                  color="bg-rose-600"
                />
                <StatCard
                  icon={ShieldCheck}
                  label="Consent Records"
                  value={stats.consents.total}
                  subtitle={`${stats.consents.granted} granted · ${stats.consents.revoked} revoked`}
                  color="bg-teal-600"
                />
                <StatCard
                  icon={Activity}
                  label="System Policies"
                  value={policies.length}
                  subtitle={`${knownPolicyKeys.length} known flags`}
                  color="bg-indigo-600"
                />
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Unable to load system statistics.</p>
          )}
        </TabsContent>

        {/* ─── Users Tab ─── */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" /> User Role Management
              </CardTitle>
              <CardDescription>View all platform users and promote or demote their roles.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by email, name, or role..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              {loadingUsers ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-16 animate-pulse rounded-md bg-muted" />
                  ))}
                </div>
              ) : filteredUsers.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No users found.</p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    Showing {filteredUsers.length} of {users.length} users
                  </p>
                  <div className="space-y-2">
                    {filteredUsers.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/30"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate font-medium">{user.full_name || "—"}</p>
                            <Badge variant={roleBadgeColor(user.role) as any} className="text-[10px]">
                              {user.role}
                            </Badge>
                          </div>
                          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                          <p className="mt-0.5 text-[10px] text-muted-foreground/70">
                            Joined {new Date(user.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Select
                          value={user.role}
                          onValueChange={(role: "student" | "teacher" | "admin") => setUserRole(user.id, role)}
                        >
                          <SelectTrigger className="w-[130px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="student">student</SelectItem>
                            <SelectItem value="teacher">teacher</SelectItem>
                            <SelectItem value="admin">admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Audit Logs Tab ─── */}
        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" /> Audit Logs
                  </CardTitle>
                  <CardDescription>Track who accessed what data, when — for PDPA/GDPR compliance.</CardDescription>
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
                    value={logActionFilter}
                    onChange={(e) => setLogActionFilter(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {uniqueLogActions.length > 0 && (
                  <Select value={logActionFilter || "__all__"} onValueChange={(v) => setLogActionFilter(v === "__all__" ? "" : v)}>
                    <SelectTrigger className="w-full sm:w-[220px]">
                      <SelectValue placeholder="Filter by action..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All actions</SelectItem>
                      {uniqueLogActions.map((action) => (
                        <SelectItem key={action} value={action}>
                          {action}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {loadingLogs ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-14 animate-pulse rounded-md bg-muted" />
                  ))}
                </div>
              ) : filteredLogs.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No audit logs found.</p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    Showing {filteredLogs.length} of {logs.length} logs
                  </p>
                  <div className="space-y-2">
                    {filteredLogs.map((log) => {
                      const isExpanded = expandedLogId === log.id
                      return (
                        <div key={log.id} className="rounded-lg border p-3 transition-colors hover:bg-muted/20">
                          <button
                            className="flex w-full items-start justify-between text-left"
                            onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium">{log.action}</p>
                                <Badge variant="outline" className="text-[10px]">
                                  {log.resource_type}
                                </Badge>
                              </div>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {new Date(log.created_at).toLocaleString()}
                                {log.resource_id ? ` · ${log.resource_id.slice(0, 8)}…` : ""}
                              </p>
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                            )}
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
        </TabsContent>

        {/* ─── Privacy / Consent Tab ─── */}
        <TabsContent value="privacy">
          <div className="space-y-4">
            {/* PDPA Summary Cards */}
            {stats && (
              <div className="grid gap-4 sm:grid-cols-3">
                <StatCard
                  icon={ShieldCheck}
                  label="Total Consent Records"
                  value={stats.consents.total}
                  color="bg-teal-600"
                />
                <StatCard
                  icon={CheckCircle2}
                  label="Consents Granted"
                  value={stats.consents.granted}
                  color="bg-emerald-600"
                />
                <StatCard
                  icon={XCircle}
                  label="Consents Revoked / Opted Out"
                  value={stats.consents.revoked}
                  color="bg-red-600"
                />
              </div>
            )}

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5" /> PDPA / GDPR Consent Dashboard
                    </CardTitle>
                    <CardDescription>
                      User consent records for data processing, analytics, and notifications.
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={loadConsents}>
                    <RefreshCw className="mr-1.5 h-3 w-3" /> Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingConsents ? (
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-14 animate-pulse rounded-md bg-muted" />
                    ))}
                  </div>
                ) : consents.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No consent records found.</p>
                ) : (
                  <div className="space-y-2">
                    {consents.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/20"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{c.consent_type}</p>
                            {c.is_granted ? (
                              <Badge variant="default" className="bg-emerald-600 text-[10px]">Granted</Badge>
                            ) : (
                              <Badge variant="destructive" className="text-[10px]">Revoked</Badge>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            User: {c.user_id.slice(0, 8)}…
                            {c.source ? ` · Source: ${c.source}` : ""}
                          </p>
                          <p className="text-[10px] text-muted-foreground/70">
                            {c.is_granted && c.granted_at
                              ? `Granted: ${new Date(c.granted_at).toLocaleString()}`
                              : c.revoked_at
                                ? `Revoked: ${new Date(c.revoked_at).toLocaleString()}`
                                : `Updated: ${new Date(c.updated_at).toLocaleString()}`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── Notifications Tab ─── */}
        <TabsContent value="notifications">
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
                <Button variant="outline" size="sm" onClick={loadNotifs}>
                  <RefreshCw className="mr-1.5 h-3 w-3" /> Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={notifStatusFilter || "__all__"} onValueChange={(v) => setNotifStatusFilter(v === "__all__" ? "" : v)}>
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

              {loadingNotifs ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-16 animate-pulse rounded-md bg-muted" />
                  ))}
                </div>
              ) : notifJobs.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No notification jobs found.</p>
              ) : (
                <div className="space-y-2">
                  {notifJobs.map((job) => (
                    <div
                      key={job.id}
                      className="flex items-center justify-between gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/20"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] uppercase">
                            {job.channel}
                          </Badge>
                          {statusBadge(job.status)}
                          <span className="text-xs text-muted-foreground">{job.template}</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          User: {job.user_id.slice(0, 8)}…
                          {job.course_id ? ` · Course: ${job.course_id.slice(0, 8)}…` : ""}
                        </p>
                        <p className="text-[10px] text-muted-foreground/70">
                          Scheduled: {new Date(job.scheduled_for).toLocaleString()}
                          {job.attempt_count > 0 ? ` · Attempts: ${job.attempt_count}` : ""}
                        </p>
                        {job.last_error && (
                          <p className="mt-1 rounded bg-destructive/10 px-2 py-1 text-[10px] text-destructive">
                            {job.last_error}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Policies Tab ─── */}
        <TabsContent value="policies">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" /> System Policy Controls
              </CardTitle>
              <CardDescription>Enable or disable platform-wide feature flags and compliance settings.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loadingPolicies ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-16 animate-pulse rounded-md bg-muted" />
                  ))}
                </div>
              ) : (
                knownPolicyKeys.map((key) => {
                  const current = policyMap.get(key)
                  const enabled = !!current?.policy_value?.enabled
                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/20"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {policyDescriptions[key] || key}
                        </p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground/70">
                          {current?.updated_at
                            ? `Last updated ${new Date(current.updated_at).toLocaleString()}`
                            : "No value set"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">{enabled ? "On" : "Off"}</span>
                        <Switch checked={enabled} onCheckedChange={(checked) => upsertPolicy(key, checked)} />
                      </div>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
