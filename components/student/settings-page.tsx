"use client"

import type React from "react"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, User, Mail } from "lucide-react"
import Link from "next/link"
import type { Profile } from "@/lib/types"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Switch } from "@/components/ui/switch"

interface SettingsPageProps {
  profile: Profile
}

export function SettingsPage({ profile }: SettingsPageProps) {
  const [fullName, setFullName] = useState(profile.full_name || "")
  const [consents, setConsents] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingConsents, setIsLoadingConsents] = useState(true)
  const [isUpdatingConsent, setIsUpdatingConsent] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    let mounted = true

    const loadConsents = async () => {
      try {
        const response = await fetch("/api/consents")
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data?.error || "Failed to load consent settings")
        }

        if (!mounted) return

        const mapped = Array.isArray(data?.consents)
          ? data.consents.reduce((acc: Record<string, boolean>, row: any) => {
              if (typeof row?.consent_type === "string") {
                acc[row.consent_type] = !!row.is_granted
              }
              return acc
            }, {})
          : {}

        setConsents(mapped)
      } catch {
        if (mounted) {
          setError("Failed to load consent settings")
        }
      } finally {
        if (mounted) {
          setIsLoadingConsents(false)
        }
      }
    }

    loadConsents()
    return () => {
      mounted = false
    }
  }, [])

  const consentItems = useMemo(
    () => [
      {
        key: "ai_processing",
        title: "AI Processing Consent",
        description: "Allow AI processing of your course questions and materials for assistant responses.",
      },
      {
        key: "email_notifications",
        title: "Email Notifications",
        description: "Allow email delivery for reminders and study notifications.",
      },
      {
        key: "line_notifications",
        title: "LINE Notifications",
        description: "Allow optional LINE delivery for reminders when configured.",
      },
      {
        key: "data_retention_opt_out",
        title: "Retention Opt-Out",
        description: "When enabled, request shorter retention/cleanup for your historical AI activity logs.",
      },
    ],
    [],
  )

  const updateConsent = async (consentType: string, isGranted: boolean) => {
    setError(null)
    setSuccess(false)
    setIsUpdatingConsent(consentType)
    try {
      const response = await fetch("/api/consents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consentType, isGranted }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || "Failed to update consent")
      }
      setConsents((prev) => ({ ...prev, [consentType]: isGranted }))
      setSuccess(true)
    } catch (consentError: any) {
      setError(consentError?.message || "Failed to update consent")
    } finally {
      setIsUpdatingConsent(null)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccess(false)

    const supabase = createClient()

    try {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
        })
        .eq("id", profile.id)

      if (updateError) throw updateError

      setSuccess(true)
      router.refresh()
    } catch (error: any) {
      setError(error.message || "Failed to update profile")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">

      <div>
        <div className="mx-auto max-w-2xl space-y-6">
          <div>
            <h2 className="text-2xl font-bold">Account Settings</h2>
            <p className="text-muted-foreground">Manage your profile and preferences</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your personal details</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="fullName"
                      placeholder="Your full name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input id="email" value={profile.email} disabled className="pl-10" />
                  </div>
                  <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                </div>
                {error && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
                {success && (
                  <div className="rounded-lg bg-green-100 p-3 text-sm text-green-700 dark:bg-green-900 dark:text-green-300">
                    Profile updated successfully!
                  </div>
                )}
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Saving..." : "Save Changes"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Account Type</CardTitle>
              <CardDescription>Your current role in the platform</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-muted p-4">
                <p className="font-medium capitalize">{profile.role}</p>
                <p className="text-sm text-muted-foreground">Role cannot be changed</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Privacy & Consent</CardTitle>
              <CardDescription>Manage consent, notifications, and retention preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingConsents ? (
                <p className="text-sm text-muted-foreground">Loading consent settings...</p>
              ) : (
                consentItems.map((item) => {
                  const checked = !!consents[item.key]
                  return (
                    <div key={item.key} className="flex items-start justify-between gap-4 rounded-lg border p-3">
                      <div className="space-y-1">
                        <p className="font-medium">{item.title}</p>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                      <Switch
                        checked={checked}
                        disabled={isUpdatingConsent === item.key}
                        onCheckedChange={(next) => updateConsent(item.key, !!next)}
                      />
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
