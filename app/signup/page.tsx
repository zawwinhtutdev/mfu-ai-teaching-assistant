"use client"

import type React from "react"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { getEmailDomainError, isUniversityEmail } from "@/lib/email-validation"
import { describeRoleForEmail, roleForEmail } from "@/lib/auth/role-from-email"
import { EducveStyleLinks } from "@/components/educve/EducveStyleLinks"
import { InnerPageLayout } from "@/components/educve/InnerPageLayout"

const noticeStyle: React.CSSProperties = {
  borderRadius: 10,
  padding: "14px 18px",
  fontSize: 16,
  fontWeight: 500,
  marginBottom: 20,
  backgroundColor: "rgba(137, 12, 37, 0.12)",
  color: "#890C25",
}

export default function SignUpPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [repeatPassword, setRepeatPassword] = useState("")
  const [fullName, setFullName] = useState("")
  // Role is not selected by the user: the database derives it from the email
  // domain (lamduan.mfu.ac.th = student, mfu.ac.th = teacher, admin allowlist).
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password !== repeatPassword) {
      setError("Passwords do not match")
      return
    }

    if (!isUniversityEmail(email)) {
      setError(getEmailDomainError())
      return
    }

    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // Send the user through /auth/callback so the profile row is created
          // and the role is assigned from public.profiles before the redirect.
          // Built from window.location.origin so it resolves correctly on both
          // localhost and the deployed domain.
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            full_name: fullName,
            // The role is NOT sent from here. The database derives it from the
            // email domain in handle_new_user(), which also refuses addresses
            // outside the university patterns.
          },
        },
      })
      if (error) throw error

      // With email confirmation enabled, signUp returns a user but no session:
      // the account is inactive until the emailed link is opened. Send the user
      // to the "check your email" screen and show which address to look for.
      if (!data.session) {
        window.location.assign(`/signup-success?email=${encodeURIComponent(email)}`)
        return
      }

      // Confirmation disabled (e.g. a stack configured with autoconfirm) returns
      // a live session immediately, so skip straight to the portal.
      window.location.assign("/auth/callback")
    } catch (signUpError: unknown) {
      setError(signUpError instanceof Error ? signUpError.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <EducveStyleLinks />
      <InnerPageLayout breadcrumbTitle="Signup" breadcrumbSubtitle="Signup">
        <section>
          <div className="td_height_120 td_height_lg_80" />
          <div className="container">
            <div className="row td_gap_y_40 justify-content-center">
              <div className="col-lg-8 col-xl-6">
                <div className="td_form_card td_style_1 td_radius_10 td_gray_bg_5">
                  <div className="td_form_card_in">
                    <h2 className="td_fs_36 td_mb_20">SIGN UP</h2>
                    <hr />
                    <div className="td_height_30 td_height_lg_30" />

                    {error ? <div style={noticeStyle}>{error}</div> : null}

                    <form onSubmit={handleSignUp}>
                      <input
                        type="text"
                        className="td_form_field td_mb_30 td_medium td_white_bg"
                        placeholder="Full Name *"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                      />
                      <input
                        type="email"
                        className="td_form_field td_mb_30 td_medium td_white_bg"
                        placeholder="MFU Email *"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />

                      {email.includes("@") ? (
                        <p
                          className="td_fs_16 td_mb_20"
                          style={{
                            color: roleForEmail(email) ? "#3f6600" : "#890C25",
                            marginTop: -14,
                          }}
                        >
                          {describeRoleForEmail(email)}
                        </p>
                      ) : null}
                      <input
                        type="password"
                        className="td_form_field td_mb_30 td_medium td_white_bg"
                        placeholder="Password *"
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <input
                        type="password"
                        className="td_form_field td_mb_30 td_medium td_white_bg"
                        placeholder="Repeat Password *"
                        required
                        minLength={6}
                        value={repeatPassword}
                        onChange={(e) => setRepeatPassword(e.target.value)}
                      />

                      <div className="td_form_card_bottom td_mb_25">
                        <button
                          type="submit"
                          disabled={isLoading}
                          className="td_btn td_style_1 td_radius_10 td_medium"
                        >
                          <span className="td_btn_in td_white_color td_accent_bg">
                            <span>{isLoading ? "Creating Account..." : "Sign Up"}</span>
                          </span>
                        </button>
                      </div>
                    </form>

                    <p className="td_form_card_text td_fs_20 td_medium td_heading_color mb-0">
                      Already have an account? <a href="/login">Log in</a>
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
