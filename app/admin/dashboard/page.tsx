"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import {
  Users,
  BookOpen,
  GraduationCap,
  MessageSquare,
  FileText,
  Bell,
  ShieldCheck,
  Activity,
} from "lucide-react"

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
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${color} text-white`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xl font-bold tabular-nums leading-tight">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
          {subtitle && <p className="mt-0.5 text-[10px] text-muted-foreground/70 leading-tight">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

export default function OverviewPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  const loadStats = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/stats")
      const data = await res.json()
      if (res.ok) setStats(data?.stats || null)
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { loadStats() }, [loadStats])

  return (
    <div>
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#00001b", margin: "0 0 4px" }}>
          System Overview
        </h1>
        <p style={{ fontSize: "14px", color: "#888", margin: 0 }}>
          Real-time platform metrics and system health
        </p>
      </div>

      {loading ? (
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
            <StatCard icon={GraduationCap} label="Enrollments" value={stats.totalEnrollments} color="bg-emerald-600" />
            <StatCard icon={MessageSquare} label="Conversations" value={stats.totalConversations} color="bg-amber-600" />
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
            <StatCard icon={Activity} label="System Policies" value={3} subtitle="3 known flags" color="bg-indigo-600" />
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Unable to load system statistics.</p>
      )}
    </div>
  )
}
