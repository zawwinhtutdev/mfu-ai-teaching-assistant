"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Users as UsersIcon, Search } from "lucide-react"

type AdminUser = {
  id: string
  email: string
  full_name: string | null
  role: "student" | "teacher" | "admin"
  created_at: string
}

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/users")
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error)
      setUsers(Array.isArray(data?.users) ? data.users : [])
    } catch (err: any) {
      setError(err?.message || "Failed to load users")
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadUsers() }, [loadUsers])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return users
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        (u.full_name || "").toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q),
    )
  }, [users, search])

  const setUserRole = async (userId: string, role: "student" | "teacher" | "admin") => {
    setError(null)
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error)
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)))
    } catch (err: any) {
      setError(err?.message || "Failed to update role")
    }
  }

  const roleBadge = (role: string) => {
    switch (role) {
      case "admin": return "destructive"
      case "teacher": return "default"
      default: return "secondary"
    }
  }

  return (
    <div>
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#00001b", margin: "0 0 4px" }}>
          User Management
        </h1>
        <p style={{ fontSize: "14px", color: "#888", margin: 0 }}>
          View all platform users and manage their roles
        </p>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
          <button className="ml-auto text-xs underline" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UsersIcon className="h-5 w-5" /> User Role Management
          </CardTitle>
          <CardDescription>View all platform users and promote or demote their roles.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by email, name, or role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No users found.</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Showing {filtered.length} of {users.length} users
              </p>
              <div className="space-y-2">
                {filtered.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/30"
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
    </div>
  )
}
