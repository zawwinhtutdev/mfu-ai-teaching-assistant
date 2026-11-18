"use client"

/**
 * Admin user management.
 *
 * Roles are separate views rather than one mixed list, and the view is chosen
 * from the sidebar (Members › Students / Teachers / Administrators) instead of
 * a tab bar on the page. Keeping the selector in the sidebar means the choice
 * survives a reload and can be linked to directly — `/admin/dashboard/users?role=teacher`
 * — which a local tab state could not do.
 *
 * The `role` query param is the single source of truth; this page never keeps a
 * second copy of it in state.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AddUserDialog } from "@/components/admin/add-user-dialog"
import { Users as UsersIcon, Search, GraduationCap, ShieldCheck, BookOpen, Plus } from "lucide-react"

type AdminRole = "student" | "teacher" | "admin"

const ROLES: AdminRole[] = ["student", "teacher", "admin"]

type AdminUser = {
  id: string
  email: string
  full_name: string | null
  role: AdminRole
  created_at: string
}

function parseRole(value: string | null): AdminRole {
  return ROLES.includes(value as AdminRole) ? (value as AdminRole) : "student"
}

export default function UsersPage() {
  // Only the search params are needed now that role changes happen at creation
  // rather than from a per-row control.
  const searchParams = useSearchParams()

  const [users, setUsers] = useState<AdminUser[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  const activeRole = parseRole(searchParams.get("role"))

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/users")
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error)
      setUsers(Array.isArray(data?.users) ? data.users : [])
    } catch (err: any) {
      setError(err?.message || "Failed to load users")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  // Group once, then filter the active group. Doing it in one pass keeps the
  // search from rescanning the whole roster on every keystroke.
  const byRole = useMemo(() => {
    const groups: Record<AdminRole, AdminUser[]> = { student: [], teacher: [], admin: [] }
    for (const user of users) {
      const role = (ROLES.includes(user.role) ? user.role : "student") as AdminRole
      groups[role].push(user)
    }
    return groups
  }, [users])

  const query = search.trim().toLowerCase()

  const filtered = useMemo(() => {
    const group = byRole[activeRole]
    if (!query) return group
    return group.filter(
      (user) =>
        user.email.toLowerCase().includes(query) ||
        (user.full_name || "").toLowerCase().includes(query),
    )
  }, [byRole, activeRole, query])

  const roleBadge = (role: AdminRole) => {
    switch (role) {
      case "admin":
        return "destructive"
      case "teacher":
        return "default"
      default:
        return "secondary"
    }
  }

  const heading =
    activeRole === "student"
      ? "Student accounts"
      : activeRole === "teacher"
        ? "Teacher accounts"
        : "Administrator accounts"

  const description =
    activeRole === "student"
      ? "Everyone enrolled in a course. Promote an account to teacher from the dropdown."
      : activeRole === "teacher"
        ? "Staff who own courses. Demote to student if a role was assigned by mistake."
        : "Full-console access. Keep this list short and reviewed."

  const RoleIcon = activeRole === "student" ? GraduationCap : activeRole === "teacher" ? BookOpen : ShieldCheck
  const group = byRole[activeRole]

  return (
    <div>
      <div style={{ marginBottom: "24px", display: "flex", alignItems: "flex-start", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#00001b", margin: "0 0 4px" }}>
            User Management
          </h1>
          <p style={{ fontSize: "14px", color: "#888", margin: 0 }}>
            Switch between students, teachers, and administrators from Members in the sidebar
          </p>
        </div>
        <Button className="ml-auto shrink-0" onClick={() => setAddOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add account
        </Button>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
          <button className="ml-auto text-xs underline" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UsersIcon className="h-5 w-5" />
            {heading}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={`Search ${activeRole === "admin" ? "administrators" : `${activeRole}s`} by email or name...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          ) : group.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <RoleIcon className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No {activeRole === "admin" ? "administrators" : `${activeRole}s`} yet.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No {activeRole === "admin" ? "administrator" : activeRole} matches “{search.trim()}”.
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Showing {filtered.length} of {group.length}{" "}
                {activeRole === "admin" ? "administrators" : `${activeRole}s`}
              </p>
              <div className="space-y-2">
                {filtered.map((user) => (
                  <div
                    key={user.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/30"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium">{user.full_name || "—"}</p>
                        <Badge variant={roleBadge(user.role) as any} className="text-[10px]">
                          {user.role}
                        </Badge>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground/70">
                        Joined {new Date(user.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {/* Role is shown as a badge only. Changing it per row was an
                        easy way to demote yourself or promote a student by
                        accident; role is set when the account is created. */}
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <AddUserDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        defaultRole={activeRole}
        onCreated={() => void loadUsers()}
      />
    </div>
  )
}
