"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GraduationCap } from "lucide-react"

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingLink, setIsCheckingLink] = useState(true)
  const [hasRecoverySession, setHasRecoverySession] = useState(false)

  useEffect(() => {
    let mounted = true
    const supabase = createClient()

    const initializeRecoverySession = async () => {
      setIsCheckingLink(true)
      setError(null)

      const code = new URLSearchParams(window.location.search).get("code")
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        if (exchangeError && mounted) {
          setError("This password reset link is invalid or expired. Please request a new one.")
        }
      }

      const { data } = await supabase.auth.getSession()
      if (!mounted) return

      setHasRecoverySession(!!data.session)
      setIsCheckingLink(false)
    }

    const { data: authSubscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setHasRecoverySession(!!session)
        setIsCheckingLink(false)
      }
    })

    void initializeRecoverySession()

    return () => {
      mounted = false
      authSubscription.subscription.unsubscribe()
    }
  }, [])

  const handleResetPassword = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!hasRecoverySession) {
      setError("Recovery session not found. Open the reset link from your email again.")
      return
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.")
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError

      setSuccess(true)
      await supabase.auth.signOut()
      setTimeout(() => {
        router.push("/login?reset=success")
      }, 1200)
    } catch (resetError: unknown) {
      setError(resetError instanceof Error ? resetError.message : "Failed to reset password")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-linear-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4 sm:p-6">
      <div className="w-full max-w-md">
        <div className="flex flex-col gap-4 sm:gap-6">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-red-600">
              <GraduationCap className="h-6 w-6 sm:h-10 sm:w-10 text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-balance">Create new password</h1>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Reset Password</CardTitle>
              <CardDescription>Set a new password for your account.</CardDescription>
            </CardHeader>
            <CardContent>
              {isCheckingLink ? (
                <p className="text-sm text-muted-foreground">Checking your reset link...</p>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  {!hasRecoverySession && (
                    <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                      This reset link is invalid or expired. Request a new password reset email.
                    </div>
                  )}
                  <div className="grid gap-2">
                    <Label htmlFor="password">New Password</Label>
                    <Input
                      id="password"
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                    />
                  </div>

                  {success && (
                    <div className="rounded-lg bg-green-100 p-3 text-sm text-green-700 dark:bg-green-900 dark:text-green-300">
                      Password updated successfully. Redirecting to login...
                    </div>
                  )}
                  {error && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

                  <Button type="submit" className="w-full" disabled={isLoading || !hasRecoverySession || success}>
                    {isLoading ? "Updating password..." : "Update password"}
                  </Button>

                  <div className="text-center text-sm">
                    Need a new link?{" "}
                    <a href="/forgot-password" className="underline underline-offset-4 text-blue-600 dark:text-blue-400">
                      Request password reset
                    </a>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
