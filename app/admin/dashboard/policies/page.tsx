"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Shield, RefreshCw } from "lucide-react"

type SystemPolicy = {
  policy_key: string
  policy_value: Record<string, any>
  updated_by: string | null
  updated_at: string
}

const KNOWN_POLICY_KEYS = ["allow_google_sso", "allow_line_notifications", "strict_course_rag"]
const POLICY_DESCRIPTIONS: Record<string, string> = {
  allow_google_sso: "Allow users to sign in via Google SSO (OIDC)",
  allow_line_notifications: "Enable LINE OA notification delivery channel",
  strict_course_rag: "Restrict AI answers strictly to uploaded course materials",
}
const POLICY_LABELS: Record<string, string> = {
  allow_google_sso: "Google SSO",
  allow_line_notifications: "LINE Notifications",
  strict_course_rag: "Strict Course RAG",
}

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<SystemPolicy[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadPolicies = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/policies")
      const data = await res.json()
      if (res.ok) setPolicies(Array.isArray(data?.policies) ? data.policies : [])
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { loadPolicies() }, [loadPolicies])

  const policyMap = useMemo(() => {
    const map = new Map<string, SystemPolicy>()
    for (const p of policies) map.set(p.policy_key, p)
    return map
  }, [policies])

  const upsertPolicy = async (policyKey: string, enabled: boolean) => {
    setError(null)
    try {
      const res = await fetch("/api/admin/policies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policyKey, policyValue: { enabled } }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error)
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

  return (
    <div>
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#00001b", margin: "0 0 4px" }}>
          System Policies
        </h1>
        <p style={{ fontSize: "14px", color: "#888", margin: 0 }}>
          Control SSO, notifications, and AI behavior feature flags
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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" /> Feature Flags & System Policies
              </CardTitle>
              <CardDescription>Toggle platform-wide feature flags. Changes take effect immediately.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadPolicies}>
              <RefreshCw className="mr-1.5 h-3 w-3" /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {KNOWN_POLICY_KEYS.map((key) => {
                const policy = policyMap.get(key)
                const enabled = !!policy?.policy_value?.enabled
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/20"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{POLICY_LABELS[key] || key}</p>
                      <p className="text-xs text-muted-foreground">{POLICY_DESCRIPTIONS[key] || key}</p>
                      {policy && (
                        <p className="mt-1 text-[10px] text-muted-foreground/70">
                          Last updated: {new Date(policy.updated_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <Switch
                      checked={enabled}
                      onCheckedChange={(checked) => upsertPolicy(key, checked)}
                    />
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
