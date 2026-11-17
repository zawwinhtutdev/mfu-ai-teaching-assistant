"use client"

import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import { EducveStyleLinks } from "@/components/educve/EducveStyleLinks"
import { InnerPageLayout } from "@/components/educve/InnerPageLayout"
import { createClient } from "@/lib/supabase/client"

const noticeStyle = {
  borderRadius: 10,
  padding: "12px 18px",
  fontSize: 15,
  fontWeight: 500,
  marginBottom: 16,
}

export default function SignUpSuccessPage() {
  return (
    <Suspense fallback={null}>
      <SignUpSuccessContent />
    </Suspense>
  )
}

function SignUpSuccessContent() {
  const searchParams = useSearchParams()
  const email = (searchParams.get("email") || "").trim()

  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle")
  const [message, setMessage] = useState<string | null>(null)

  const resend = async () => {
    if (!email) return
    setStatus("sending")
    setMessage(null)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      })
      if (error) throw error
      setStatus("sent")
      setMessage("Confirmation email sent again. Check your inbox and spam folder.")
    } catch (resendError) {
      setStatus("error")
      setMessage(resendError instanceof Error ? resendError.message : "Could not resend the email.")
    }
  }

  return (
    <>
      <EducveStyleLinks />
      <InnerPageLayout breadcrumbTitle="Sign Up" breadcrumbSubtitle="Account Created">
        <section>
          <div className="td_height_120 td_height_lg_80" />
          <div className="container">
            <div className="row justify-content-center">
              <div className="col-lg-6">
                <div className="td_form_card td_style_1 td_radius_10 td_gray_bg_5">
                  <div className="td_form_card_in text-center">
                    <div
                      style={{
                        width: 80,
                        height: 80,
                        borderRadius: "50%",
                        backgroundColor: "rgba(22, 163, 74, 0.12)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "0 auto 24px",
                        fontSize: 36,
                      }}
                    >
                      ✉️
                    </div>
                    <h2 className="td_fs_36 td_mb_20">Check Your Email</h2>

                    {email ? (
                      <p className="td_fs_18 td_mb_15" style={{ color: "#666" }}>
                        We sent a confirmation link to{" "}
                        <strong style={{ color: "#222" }}>{email}</strong>. Open it to activate
                        your account, then log in.
                      </p>
                    ) : (
                      <p className="td_fs_18 td_mb_15" style={{ color: "#666" }}>
                        We sent you a confirmation link. Open it to activate your account, then
                        log in.
                      </p>
                    )}

                    <p className="td_fs_16 td_mb_30" style={{ color: "#888" }}>
                      The link expires in one hour. If you do not see it, check your spam folder.
                    </p>

                    {message ? (
                      <div
                        style={{
                          ...noticeStyle,
                          backgroundColor:
                            status === "sent" ? "rgba(22, 163, 74, 0.12)" : "rgba(137, 12, 37, 0.12)",
                          color: status === "sent" ? "#166534" : "#890C25",
                        }}
                      >
                        {message}
                      </div>
                    ) : null}

                    <div
                      style={{
                        display: "flex",
                        gap: 12,
                        justifyContent: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <a href="/login" className="td_btn td_style_1 td_radius_10 td_medium">
                        <span className="td_btn_in td_white_color td_accent_bg">
                          <span>Back to Login</span>
                        </span>
                      </a>

                      {email ? (
                        <button
                          type="button"
                          onClick={() => void resend()}
                          disabled={status === "sending"}
                          className="td_btn td_style_1 td_radius_10 td_medium"
                        >
                          <span className="td_btn_in td_white_color td_gray_bg_7">
                            <span>{status === "sending" ? "Sending…" : "Resend email"}</span>
                          </span>
                        </button>
                      ) : null}
                    </div>
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
