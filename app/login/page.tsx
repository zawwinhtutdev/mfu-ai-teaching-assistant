"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { getEmailDomainError, isUniversityEmail } from "@/lib/email-validation"
import { getDefaultRouteForRole } from "@/lib/demo-auth"
import { toUserRole } from "@/lib/auth/roles"
import { EducveStyleLinks } from "@/components/educve/EducveStyleLinks"
import { InnerPageLayout } from "@/components/educve/InnerPageLayout"

const noticeStyle: React.CSSProperties = {
  borderRadius: 10,
  padding: "14px 18px",
  fontSize: 16,
  fontWeight: 500,
  marginBottom: 20,
}

const oauthErrorMessages: Record<string, string> = {
  oauth_failed: "Google sign-in could not be completed. Please try again.",
  university_email_required: getEmailDomainError(),
  account_exists:
    "An account with this email already exists. Sign in with your email and password, then link Google from Settings.",
  oauth_cancelled: "Google sign-in was cancelled.",
  profile_missing:
    "Your account is missing a profile. Please contact the site administrator.",
}

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [resetSuccess, setResetSuccess] = useState(false)
  // null = still checking, so the button does not flash "unavailable" on load.
  const [googleEnabled, setGoogleEnabled] = useState<boolean | null>(null)

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    setResetSuccess(searchParams.get("reset") === "success")

    const oauthError = searchParams.get("error")
    if (oauthError) {
      setError(oauthErrorMessages[oauthError] || "Google sign-in could not be completed. Please try again.")
    }

    // Ask the server whether Google is actually configured, so the button can
    // be hidden rather than failing after a click.
    let cancelled = false
    fetch("/api/auth/google/status", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!cancelled) setGoogleEnabled(payload?.enabled === true)
      })
      .catch(() => {
        if (!cancelled) setGoogleEnabled(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const handleSsoLogin = async () => {
    // Google SSO goes straight to the Google account chooser. Terms acceptance
    // is collected on the provider side, so it must not block this button.
    setError(null)
    setIsLoading(true)
    try {
      if (!googleEnabled) {
        throw new Error("Google SSO is not configured yet. Please use email login for now.")
      }

      await fetch("/api/demo-auth/logout", { method: "POST" })
      const supabase = createClient()
      const origin = window.location.origin
      const { error: ssoError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback`,
          queryParams: {
            hd: "mfu.ac.th",
          },
        },
      })
      if (ssoError) throw ssoError
    } catch (ssoLoginError: any) {
      setError(ssoLoginError?.message || "Failed to start SSO login")
      setIsLoading(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!acceptTerms) {
      setError("Please accept the terms and conditions to continue")
      return
    }

    if (!isUniversityEmail(email)) {
      setError(getEmailDomainError())
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // One sign-in path: real Supabase credentials. The demo-cookie shortcut
      // used to be tried first, which meant a seed account authenticated
      // against a client-side list rather than against the database, and any
      // account not in that list took a different code path. Every seeded
      // account is a real auth user, so the shortcut is gone.
      const supabase = createClient()
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        throw signInError
      }

      // Role is read from public.profiles — the authoritative source. Falling
      // back to user_metadata would let a user rewrite their own role.
      let role: string = "student"

      if (data.user?.id) {
        const { data: profileData } = await supabase.from("profiles").select("role").eq("id", data.user.id).single()
        role = toUserRole(profileData?.role)
      }

      window.location.assign(getDefaultRouteForRole(role))
    } catch (loginError: unknown) {
      setError(loginError instanceof Error ? loginError.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <EducveStyleLinks />
      <InnerPageLayout breadcrumbTitle="Login" breadcrumbSubtitle="Login">
        <section>
          <div className="td_height_120 td_height_lg_80" />
          <div className="container">
            <div className="row td_gap_y_40 justify-content-center">
              <div className="col-lg-8 col-xl-6">
                <div className="td_form_card td_style_1 td_radius_10 td_gray_bg_5">
                  <div className="td_form_card_in">
                    <h2 className="td_fs_36 td_mb_20">LOGIN</h2>
                    <hr />
                    <div className="td_height_30 td_height_lg_30" />

                    {resetSuccess ? (
                      <div
                        style={{
                          ...noticeStyle,
                          backgroundColor: "rgba(22, 163, 74, 0.12)",
                          color: "#166534",
                        }}
                      >
                        Password reset successful. Please log in with your new password.
                      </div>
                    ) : null}

                    {error ? (
                      <div
                        style={{
                          ...noticeStyle,
                          backgroundColor: "rgba(137, 12, 37, 0.12)",
                          color: "#890C25",
                        }}
                      >
                        {error}
                      </div>
                    ) : null}

                    <form onSubmit={handleLogin}>
                      <input
                        type="email"
                        className="td_form_field td_mb_30 td_medium td_white_bg"
                        placeholder="MFU Email *"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                      <input
                        type="password"
                        className="td_form_field td_mb_10 td_medium td_white_bg"
                        placeholder="Password *"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <div className="td_form_card_text_2 td_mb_40">
                        <div>
                          <a href="/forgot-password" className="td_semibold td_accent_color">
                            Forgot password?
                          </a>
                        </div>
                        <div className="td_accent_color">
                          <div className="td_custom_checkbox">
                            <input
                              type="checkbox"
                              id="accept_terms"
                              checked={acceptTerms}
                              onChange={(e) => setAcceptTerms(e.target.checked)}
                            />
                            <label htmlFor="accept_terms">
                              I accept the <a href="/terms">terms</a>
                            </label>
                          </div>
                        </div>
                      </div>

                      <div className="td_form_card_bottom td_mb_25">
                        <button
                          type="submit"
                          disabled={isLoading || !acceptTerms}
                          className="td_btn td_style_1 td_radius_10 td_medium"
                        >
                          <span className="td_btn_in td_white_color td_accent_bg">
                            <span>{isLoading ? "Logging In..." : "Login"}</span>
                          </span>
                        </button>
                        <p className="td_fs_20 mb-0 td_medium td_heading_color">or continue with</p>
                        <button
                          type="button"
                          onClick={handleSsoLogin}
                          disabled={isLoading || googleEnabled !== true}
                          title={
                            googleEnabled === true
                              ? undefined
                              : "Google sign-in is not configured on this environment"
                          }
                          className="td_btn td_style_1 td_radius_10 td_medium"
                        >
                          <span className="td_btn_in td_heading_color td_white_bg">
                            <span>Google SSO</span>
                          </span>
                        </button>
                      </div>
                    </form>

                    <p className="td_form_card_text td_fs_20 td_medium td_heading_color td_mb_20">
                      University IT staff: <a href="/admin/login">sign in to the Admin Console</a>
                    </p>

                    <p className="td_form_card_text td_fs_20 td_medium td_heading_color mb-0">
                      {"Don't have an account? "} <a href="/signup">Sign up</a>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="td_height_120 td_height_lg_80" />
        </section>
      </InnerPageLayout>
    </>
  )
}
