"use client"

import type React from "react"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { getEmailDomainError, isUniversityEmail } from "@/lib/email-validation"
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
  const [role, setRole] = useState<"student" | "teacher">("student")
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
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || `${window.location.origin}/chat`,
          data: {
            full_name: fullName,
            role,
          },
        },
      })
      if (error) throw error
      window.location.assign("/signup-success")
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
                      <select
                        className="td_form_field td_mb_30 td_medium td_white_bg"
                        value={role}
                        onChange={(e) => setRole(e.target.value as "student" | "teacher")}
                      >
                        <option value="student">Student</option>
                        <option value="teacher">Teacher</option>
                      </select>
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
