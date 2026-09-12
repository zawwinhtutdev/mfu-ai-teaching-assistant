"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ShieldCheck, CheckCircle2, XCircle, RefreshCw } from "lucide-react"

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

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
  return (
    <Card className="relative overflow-hidden">
      <div className={`absolute inset-0 opacity-[0.04] ${color}`} />
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${color} text-white`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-2xl font-bold tabular-nums">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

export default function PrivacyPage() {
  const [consents, setConsents] = useState<ConsentRecord[]>([])
  const [loading, setLoading] = useState(true)

  const loadConsents = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/consents")
      const data = await res.json()
      if (res.ok) setConsents(Array.isArray(data?.consents) ? data.consents : [])
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { loadConsents() }, [loadConsents])

  const granted = consents.filter((c) => c.is_granted).length
  const revoked = consents.filter((c) => !c.is_granted).length

  return (
    <div>
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#00001b", margin: "0 0 4px" }}>
          Privacy & Consent
        </h1>
        <p style={{ fontSize: "14px", color: "#888", margin: 0 }}>
          PDPA/GDPR consent records for data processing, analytics, and notifications
        </p>
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard icon={ShieldCheck} label="Total Records" value={consents.length} color="bg-teal-600" />
        <StatCard icon={CheckCircle2} label="Granted" value={granted} color="bg-emerald-600" />
        <StatCard icon={XCircle} label="Revoked / Opted Out" value={revoked} color="bg-red-600" />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" /> PDPA / GDPR Consent Dashboard
              </CardTitle>
              <CardDescription>User consent records for data processing, analytics, and notifications.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadConsents}>
              <RefreshCw className="mr-1.5 h-3 w-3" /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
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
                      User: {c.user_id.slice(0, 12)}…{c.source ? ` · Source: ${c.source}` : ""}
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
  )
}
