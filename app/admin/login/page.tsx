"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { EducveStyleLinks } from "@/components/educve/EducveStyleLinks"
import { BrandIcon } from "@/components/brand-icon"
import { toUserRole } from "@/lib/auth/roles"

export default function AdminLoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [signedInAs, setSignedInAs] = useState<{ role: string; email: string; fullName: string } | null>(null)
  const [denied, setDenied] = useState(false)

  // Explain why an admin-page visit landed back here: either the guard sent the
  // visitor away (?denied=admin) or a non-admin demo account is still signed in.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setDenied(params.get("denied") === "admin")

    let cancelled = false
    fetch("/api/demo-auth/session", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (cancelled) return
        const account = payload?.isDemo ? payload.account : null
        setSignedInAs(account && account.role !== "admin" ? account : null)
      })
      .catch(() => {
        /* ignore — the form still works */
      })

    return () => {
      cancelled = true
    }
  }, [])

  const handleSignOut = async () => {
    try {
      await fetch("/api/demo-auth/logout", { method: "POST" })
      const { createClient } = await import("@/lib/supabase/client")
      await createClient().auth.signOut()
    } catch {
      /* ignore — reloading is still the right next step */
    }
    window.location.assign("/admin/login")
  }

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      // Real Supabase credentials only. The demo-cookie shortcut was removed so
      // the admin console authenticates against the database like every other
      // surface; the seed admin is a real auth user.
      const supabase = createClient()
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        throw signInError
      }

      if (!data.user) {
        throw new Error("Login failed — no user returned.")
      }

      // Verify admin role from profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single()

      // Authoritative role check. user_metadata is user-writable and must never
      // be consulted here — doing so would let any account claim admin.
      const role = toUserRole(profile?.role)

      if (role !== "admin") {
        await supabase.auth.signOut()
        throw new Error("Access denied — this account does not have admin privileges.")
      }

      window.location.assign("/admin/dashboard")
    } catch (loginError: unknown) {
      setError(loginError instanceof Error ? loginError.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <EducveStyleLinks />

      {/* Top Bar */}
      <div
        style={{
          background: "#00001b",
          padding: "10px 0",
          borderBottom: "3px solid #890c25",
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            padding: "0 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <BrandIcon size={40} tone="light" priority />
            <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
              <span
                style={{
                  color: "#fff",
                  fontSize: "18px",
                  fontWeight: 700,
                  fontFamily: "'Euclid Circular A', sans-serif",
                }}
              >
                MFU AI
              </span>
              <span
                style={{
                  color: "rgba(255,255,255,0.7)",
                  fontSize: "12px",
                  fontWeight: 500,
                  fontFamily: "'Euclid Circular A', sans-serif",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase" as const,
                }}
              >
                Teaching Assistant
              </span>
            </div>
          </div>
          <span
            style={{
              color: "rgba(255,255,255,0.5)",
              fontSize: "13px",
              fontFamily: "'Euclid Circular A', sans-serif",
            }}
          >
            Admin Console
          </span>
        </div>
      </div>

      {/* Hero Banner */}
      <div
        style={{
          background: "linear-gradient(135deg, #00001b 0%, #1a1a3e 40%, #890c25 100%)",
          padding: "60px 20px",
          textAlign: "center" as const,
          position: "relative" as const,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute" as const,
            top: "20px",
            right: "80px",
            width: "100px",
            height: "100px",
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.15) 1.5px, transparent 1.5px)",
            backgroundSize: "14px 14px",
            pointerEvents: "none" as const,
          }}
        />
        <div
          style={{
            position: "absolute" as const,
            bottom: "15px",
            left: "60px",
            width: "80px",
            height: "80px",
            borderRadius: "50%",
            border: "1.5px solid rgba(137,12,37,0.4)",
            pointerEvents: "none" as const,
          }}
        />

        <h1
          style={{
            color: "#fff",
            fontSize: "32px",
            fontWeight: 700,
            fontFamily: "'Euclid Circular A', sans-serif",
            margin: "0 0 8px 0",
          }}
        >
          Admin Console
        </h1>
        <p
          style={{
            color: "rgba(255,255,255,0.6)",
            fontSize: "15px",
            fontFamily: "'Euclid Circular A', sans-serif",
            margin: 0,
          }}
        >
          Home / Admin Login
        </p>
      </div>

      {/* Login Form Section */}
      <section
        style={{
          background: "#f4f3ef",
          minHeight: "calc(100vh - 220px)",
          padding: "60px 20px 80px",
          fontFamily: "'Euclid Circular A', sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: "1100px",
            margin: "0 auto",
            display: "flex",
            gap: "40px",
            alignItems: "flex-start",
            flexWrap: "wrap" as const,
            justifyContent: "center",
          }}
        >
          {/* Login Card */}
          <div
            style={{
              flex: "1 1 420px",
              maxWidth: "480px",
              background: "#fff",
              borderRadius: "10px",
              padding: "40px 36px",
              boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
            }}
          >
            <h2
              style={{
                fontSize: "28px",
                fontWeight: 700,
                color: "#00001b",
                marginBottom: "8px",
                fontFamily: "'Euclid Circular A', sans-serif",
              }}
            >
              ADMIN LOGIN
            </h2>
            <hr
              style={{
                border: "none",
                borderTop: "1px solid #d9d9d9",
                margin: "16px 0 28px",
              }}
            />

            {/* Restricted Badge */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "12px 16px",
                borderRadius: "8px",
                background: "rgba(137, 12, 37, 0.06)",
                border: "1px solid rgba(137, 12, 37, 0.12)",
                marginBottom: "24px",
                fontSize: "14px",
                color: "#890c25",
                fontWeight: 500,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Restricted — University IT &amp; authorized staff only
            </div>

            {/* Why am I here? */}
            {(denied || signedInAs) && (
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: "8px",
                  background: "#fff7e6",
                  border: "1px solid #f0d9a8",
                  color: "#7a5200",
                  fontSize: "14px",
                  lineHeight: 1.55,
                  marginBottom: "24px",
                }}
              >
                {signedInAs ? (
                  <>
                    You are signed in as <strong>{signedInAs.email}</strong> ({signedInAs.role}). The Admin
                    Console requires an admin account.
                  </>
                ) : (
                  <>The account you are signed in with does not have access to the Admin Console.</>
                )}
                <button
                  type="button"
                  onClick={handleSignOut}
                  style={{
                    display: "inline-block",
                    marginTop: "10px",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    border: "1px solid #d9b56b",
                    background: "#fff",
                    color: "#7a5200",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Sign out and switch account
                </button>
              </div>
            )}

            {/* Error */}
            {error && (
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: "8px",
                  background: "rgba(137, 12, 37, 0.08)",
                  color: "#890c25",
                  fontSize: "14px",
                  fontWeight: 500,
                  marginBottom: "24px",
                  lineHeight: 1.5,
                }}
              >
                {error}
              </div>
            )}

            <form onSubmit={handleAdminLogin}>
              <input
                type="email"
                required
                placeholder="Admin Email *"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: "100%",
                  padding: "14px 18px",
                  borderRadius: "8px",
                  border: "1px solid #d9d9d9",
                  background: "#fff",
                  color: "#00001b",
                  fontSize: "16px",
                  fontFamily: "'Euclid Circular A', sans-serif",
                  fontWeight: 500,
                  outline: "none",
                  transition: "border-color 0.2s",
                  boxSizing: "border-box" as const,
                  marginBottom: "20px",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#890c25")}
                onBlur={(e) => (e.target.style.borderColor = "#d9d9d9")}
              />

              <div style={{ marginBottom: "28px", position: "relative" as const }}>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Password *"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "14px 48px 14px 18px",
                    borderRadius: "8px",
                    border: "1px solid #d9d9d9",
                    background: "#fff",
                    color: "#00001b",
                    fontSize: "16px",
                    fontFamily: "'Euclid Circular A', sans-serif",
                    fontWeight: 500,
                    outline: "none",
                    transition: "border-color 0.2s",
                    boxSizing: "border-box" as const,
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#890c25")}
                  onBlur={(e) => (e.target.style.borderColor = "#d9d9d9")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute" as const,
                    right: "14px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#999",
                    padding: "4px",
                  }}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="td_btn td_style_1 td_radius_10 td_medium"
                style={{
                  width: "100%",
                  display: "block",
                  cursor: isLoading ? "not-allowed" : "pointer",
                  opacity: isLoading ? 0.7 : 1,
                }}
              >
                <span className="td_btn_in td_white_color td_accent_bg" style={{ display: "block", textAlign: "center" as const }}>
                  <span>{isLoading ? "Signing in..." : "Sign In to Admin Console"}</span>
                </span>
              </button>
            </form>

            <div style={{ marginTop: "24px", textAlign: "center" as const }}>
              <p style={{ fontSize: "13px", color: "#999", margin: 0, lineHeight: 1.6 }}>
                This system is monitored. Unauthorized access attempts are logged.
              </p>
            </div>
          </div>

          {/* Info Panel */}
          <div
            style={{
              flex: "1 1 380px",
              maxWidth: "480px",
              background: "#00001b",
              borderRadius: "10px",
              padding: "40px 36px",
              color: "#fff",
            }}
          >
            <h3
              style={{
                fontSize: "22px",
                fontWeight: 700,
                marginBottom: "16px",
                fontFamily: "'Euclid Circular A', sans-serif",
                color: "#fff",
              }}
            >
              Internal Management Portal
            </h3>
            <p
              style={{
                color: "rgba(255,255,255,0.6)",
                fontSize: "14px",
                lineHeight: 1.7,
                marginBottom: "28px",
              }}
            >
              The Admin Console provides University IT staff and authorized administrators
              with tools to manage the AI Teaching Assistant platform.
            </p>

            <div style={{ display: "flex", flexDirection: "column" as const, gap: "16px" }}>
              {[
                { title: "User Management", desc: "Manage student, teacher, and admin roles across the platform" },
                { title: "Audit & Compliance", desc: "View detailed audit logs and PDPA/GDPR consent records" },
                { title: "System Policies", desc: "Control SSO, notifications, and AI behavior settings" },
                { title: "Notifications", desc: "Monitor delivery status of email, LINE, and push notifications" },
              ].map((item) => (
                <div
                  key={item.title}
                  style={{
                    display: "flex",
                    gap: "12px",
                    alignItems: "flex-start",
                  }}
                >
                  <div
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: "#890c25",
                      marginTop: "6px",
                      flexShrink: 0,
                    }}
                  />
                  <div>
                    <p style={{ fontWeight: 600, fontSize: "14px", margin: "0 0 2px 0", color: "#fff" }}>
                      {item.title}
                    </p>
                    <p style={{ fontSize: "13px", margin: 0, color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Security notice */}
            <div
              style={{
                marginTop: "32px",
                padding: "16px",
                borderRadius: "8px",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                fontSize: "13px",
                color: "rgba(255,255,255,0.5)",
                lineHeight: 1.7,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: "inline", verticalAlign: "middle", marginRight: "6px", opacity: 0.6 }}>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              All login attempts and admin actions are recorded in the audit log for compliance purposes.
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <div
        style={{
          background: "#00001b",
          padding: "20px",
          textAlign: "center" as const,
          fontFamily: "'Euclid Circular A', sans-serif",
          borderTop: "3px solid #890c25",
        }}
      >
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px", margin: 0 }}>
          © {new Date().getFullYear()} Mae Fah Luang University — AI Teaching Assistant Admin Console
        </p>
      </div>
    </>
  )
}
