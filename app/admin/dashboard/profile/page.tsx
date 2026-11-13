"use client"

/**
 * Admin profile.
 *
 * The console previously showed "Signed in as admin@mfu.ac.th" as dead text with
 * no way to see the account or sign out. This page makes the account concrete:
 * who you are, what role the database has recorded, and the session actions.
 */

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, LogOut, ShieldCheck, Mail, Building2 } from "lucide-react"

type Profile = {
  id: string
  email: string
  name: string
  role: string
  organization: string
}

export default function AdminProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [statusRes, meRes] = await Promise.all([
        fetch("/api/admin/status", { cache: "no-store" }),
        fetch("/api/admin/users", { cache: "no-store" }),
      ])
      const status = await statusRes.json()
      if (!statusRes.ok) throw new Error(status?.error || "Could not load your account")

      // The status endpoint gives the session identity; the users list provides
      // the profile row's stored name, so the page shows what the database has
      // rather than only what the auth token carries.
      let storedName = ""
      let storedRole = "admin"
      if (meRes.ok) {
        const users = await meRes.json()
        const match = (Array.isArray(users?.users) ? users.users : []).find(
          (u: any) => String(u.email).toLowerCase() === String(status.email).toLowerCase(),
        )
        if (match) {
          storedName = match.full_name || ""
          storedRole = match.role || "admin"
        }
      }

      setProfile({
        id: "",
        email: status.email || "",
        name: storedName || status.name || "Administrator",
        role: storedRole,
        organization: "Mae Fah Luang University",
      })
    } catch (cause: any) {
      setError(cause?.message || "Could not load your account")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const signOut = async () => {
    setSigningOut(true)
    try {
      await fetch("/api/demo-auth/logout", { method: "POST" })
      const { createClient } = await import("@/lib/supabase/client")
      await createClient().auth.signOut()
    } catch {
      /* redirect regardless */
    }
    window.location.assign("/admin/login")
  }

  const initials = (profile?.name || profile?.email || "A")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")

  return (
    <div className="space-y-4">
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#00001b", margin: "0 0 4px" }}>My profile</h1>
        <p style={{ fontSize: 14, color: "#888", margin: 0 }}>
          The account you are signed in with and your session controls
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : profile ? (
        <>
          <Card>
            <CardContent className="flex flex-wrap items-center gap-4 py-5">
              <span
                aria-hidden
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 999,
                  background: "#232334",
                  color: "#fff",
                  fontSize: 20,
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: "0 0 auto",
                }}
              >
                {initials || "A"}
              </span>
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-lg font-semibold">
                  {profile.name}
                  <Badge variant="destructive" className="text-[10px] uppercase">
                    {profile.role}
                  </Badge>
                </p>
                <p className="text-sm text-muted-foreground">{profile.email}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Account details</CardTitle>
              <CardDescription>Recorded in the platform database</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="w-32 text-muted-foreground">Email</span>
                <span className="font-medium">{profile.email}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                <span className="w-32 text-muted-foreground">Role</span>
                <span className="font-medium capitalize">{profile.role}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="w-32 text-muted-foreground">Organization</span>
                <span className="font-medium">{profile.organization}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Session</CardTitle>
              <CardDescription>
                Signing out ends this session and returns you to the admin login.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={() => void signOut()} disabled={signingOut}>
                {signingOut ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="mr-2 h-4 w-4" />
                )}
                {signingOut ? "Signing out…" : "Sign out"}
              </Button>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}
