"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  ChevronDown,
  Compass,
  Files,
  Lightbulb,
  PanelLeft,
  PanelLeftClose,
  Plus,
  Settings as SettingsIcon,
  Sparkles,
  User,
  BookOpen,
  Building,
  MessageSquare,
  X,
} from "lucide-react"
import { useState, useEffect } from "react"
import { ProfileButton } from "@/components/animate-ui/components/profile/profile-button"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

interface ChatSidebarProps {
  isOpen?: boolean
  onClose?: () => void
  isMobile?: boolean
  onOpenSettings?: () => void
}

/** Socra-style sidebar: inset card, icon rail collapse, recent list, footer profile. */
export function ChatSidebar({ isOpen = true, onClose, isMobile = false, onOpenSettings }: ChatSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [authRole, setAuthRole] = useState<"student" | "teacher" | "admin" | null>(null)
  const [conversations, setConversations] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [userProfile, setUserProfile] = useState({
    name: "Student",
    email: "student@mfu.ac.th",
    role: "Student Mode",
  })
  const [mfuCampusOpen, setMfuCampusOpen] = useState(false)
  const [isRail, setIsRail] = useState(false)

  useEffect(() => {
    try {
      setIsRail(localStorage.getItem("mf-chat-rail") === "1")
    } catch {}
  }, [])

  const toggleRail = () => {
    setIsRail((prev) => {
      const next = !prev
      try {
        localStorage.setItem("mf-chat-rail", next ? "1" : "0")
      } catch {}
      return next
    })
  }

  useEffect(() => {
    fetch("/api/conversations")
      .then(async (res) => {
        const data = await res.json()
        setConversations(Array.isArray(data.conversations) ? data.conversations : [])
        setIsLoading(false)
      })
      .catch((error) => {
        console.error("[chat] error loading conversations:", error)
        setConversations([])
        setIsLoading(false)
      })

    const fetchUserProfile = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, role")
            .eq("id", user.id)
            .single()

          if (profile) {
            const normalizedRole =
              profile.role === "teacher" || profile.role === "admin" ? profile.role : "student"
            setAuthRole(normalizedRole)
            setUserProfile({
              name: profile.full_name || "User",
              email: user.email || "user@mfu.ac.th",
              role:
                normalizedRole === "teacher"
                  ? "Teacher Mode"
                  : normalizedRole === "admin"
                    ? "Admin Mode"
                    : "Student Mode",
            })
          } else {
            // No profiles row: fall back to the lowest role. Never read the role
            // from user_metadata, which the user can rewrite client-side.
            const fallbackRole = "student"
            setAuthRole(fallbackRole)
            setUserProfile({
              name: user.user_metadata?.full_name || "User",
              email: user.email || "user@mfu.ac.th",
              role: "Student Mode",
            })
          }
        } else {
          const demoRes = await fetch("/api/demo-auth/session")
          const demoSession = await demoRes.json()

          if (demoSession?.isDemo && demoSession?.account) {
            setAuthRole(demoSession.account.role === "teacher" ? "teacher" : "student")
            setUserProfile({
              name: demoSession.account.fullName || "Demo User",
              email: demoSession.account.email,
              role: demoSession.account.role === "teacher" ? "Teacher Mode" : "Student Mode",
            })
          } else {
            setAuthRole(null)
            setUserProfile({ name: "Guest", email: "guest@mfu.ac.th", role: "Student Mode" })
          }
        }
      } catch (error) {
        console.error("[chat] error fetching profile:", error)
      }
    }

    fetchUserProfile()
  }, [pathname])

  const showStudentPortal = authRole !== "teacher"
  const showTeacherPortal = authRole !== "student"

  const go = (href: string, externalTarget?: boolean) => {
    if (externalTarget) {
      window.open(href, "_blank", "noopener,noreferrer")
    } else {
      router.push(href)
    }
    if (isMobile && onClose) onClose()
  }

  const iconSize = 19

  const sidebarContent = (
    <aside
      className="mf-sidebar"
      data-rail={!isMobile && isRail ? "true" : "false"}
      data-mobileopen={isMobile && isOpen ? "true" : "false"}
      aria-label="Chat navigation"
    >
      <div className="mf-sidebar-head">
        <button
          type="button"
          onClick={() => go("/chat")}
          className="mf-wordmark"
          style={{ background: "transparent", border: 0, cursor: "pointer", padding: 0 }}
          aria-label="MFU AI Assistant home"
        >
          MFU<span className="mf-wordmark-thin">AI</span>
        </button>
        {isMobile ? (
          <button type="button" className="mf-railbtn" onClick={onClose} aria-label="Close navigation">
            <X size={iconSize} />
          </button>
        ) : (
          <button
            type="button"
            className="mf-railbtn"
            onClick={toggleRail}
            aria-label={isRail ? "Expand history panel" : "Collapse history panel"}
            title={isRail ? "Expand" : "Collapse"}
          >
            {isRail ? <PanelLeft size={iconSize} /> : <PanelLeftClose size={iconSize} />}
          </button>
        )}
      </div>

      <nav className="mf-nav">
        <button type="button" className="mf-navitem" onClick={() => go("/chat")} title="New chat">
          <Plus size={iconSize} />
          <span className="mf-grow">New chat</span>
        </button>

        {showStudentPortal && (
          <button
            type="button"
            className="mf-navitem"
            data-active={pathname.startsWith("/studentportal") ? "true" : "false"}
            onClick={() => go("/studentportal", true)}
            title="Student Portal"
          >
            <User size={iconSize} />
            <span className="mf-grow">Student Portal</span>
          </button>
        )}
        {showTeacherPortal && (
          <button
            type="button"
            className="mf-navitem"
            data-active={pathname.startsWith("/teacherportal") ? "true" : "false"}
            onClick={() => go("/teacherportal", true)}
            title="Teacher Portal"
          >
            <BookOpen size={iconSize} />
            <span className="mf-grow">Teacher Portal</span>
          </button>
        )}

        <button
          type="button"
          className="mf-navitem"
          data-active={pathname.startsWith("/ai-agents") ? "true" : "false"}
          onClick={() => go("/ai-agents")}
          title="AI Agents"
        >
          <Sparkles size={iconSize} />
          <span className="mf-grow">AI Agents</span>
        </button>

        <button
          type="button"
          className="mf-navitem"
          data-active={pathname.startsWith("/chat/documents") ? "true" : "false"}
          onClick={() => go("/chat/documents")}
          title="Documents RAG"
        >
          <Files size={iconSize} />
          <span className="mf-grow">Documents RAG</span>
        </button>

        <button
          type="button"
          className="mf-navitem"
          onClick={() => setMfuCampusOpen((v) => !v)}
          aria-expanded={mfuCampusOpen}
          title="MFU Daily"
        >
          <Building size={iconSize} />
          <span className="mf-grow">MFU Daily</span>
          <ChevronDown
            size={16}
            className="mf-chevron"
            style={{ transform: mfuCampusOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }}
          />
        </button>
        {mfuCampusOpen && (
          <div style={{ paddingLeft: 34, display: "flex", flexDirection: "column", gap: 2 }}>
            {[
              { href: "https://teams.microsoft.com/", label: "Microsoft Teams" },
              { href: "https://meet.google.com/", label: "Google Meet" },
              { href: "https://classroom.google.com/", label: "Google Classroom" },
              { href: "https://en.mfu.ac.th/home.html", label: "MFU Main Website" },
              { href: "https://reg.mfu.ac.th/", label: "MFU Reg" },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="mf-navitem"
                style={{ height: 34, fontSize: 13.5 }}
              >
                <span className="mf-grow">{item.label}</span>
              </a>
            ))}
          </div>
        )}
      </nav>

      <div className="mf-divider" />

      <div className="mf-recent">
        <div className="mf-recent-label">Recent</div>
        <div className="mf-recent-list">
          {isLoading ? (
            <div className="mf-recent-empty">Loading…</div>
          ) : conversations.length === 0 ? (
            <div className="mf-recent-empty">Start a new conversation</div>
          ) : (
            conversations.map((conv) => (
              <Link
                key={conv.id}
                href={`/chat/${conv.id}`}
                className="mf-recent-item"
                data-active={pathname === `/chat/${conv.id}` ? "true" : "false"}
                onClick={() => {
                  if (isMobile && onClose) onClose()
                }}
              >
                <span className="mf-recent-title">{conv.title}</span>
                <span className="mf-recent-meta">
                  {conv.updated_at ? new Date(conv.updated_at).toLocaleDateString() : ""}
                </span>
              </Link>
            ))
          )}
        </div>
      </div>

      <div className="mf-sidebar-foot">
        <button
          type="button"
          className="mf-navitem"
          onClick={() => {
            onOpenSettings?.()
            if (isMobile && onClose) onClose()
          }}
          title="Settings"
        >
          <SettingsIcon size={iconSize} />
          <span className="mf-grow">Settings</span>
        </button>

        <div className="mf-profile-slot">
          <ProfileButton
            className="mf-profilecard"
            userName={userProfile.email.split("@")[0]}
            userEmail={userProfile.email}
            userRole={userProfile.role}
            onProfileClick={() => go("/dashboard")}
            onSettingsClick={() => {
              onOpenSettings?.()
              if (isMobile && onClose) onClose()
            }}
            onLogoutClick={async () => {
              const supabase = createClient()
              await fetch("/api/demo-auth/logout", { method: "POST" })
              await supabase.auth.signOut()
              router.push("/")
              router.refresh()
            }}
            onTokenUsageClick={() => {}}
            onFeedbackClick={() => {}}
          />
        </div>
      </div>

    </aside>
  )

  if (isMobile) {
    return (
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mf-backdrop"
              onClick={onClose}
            />
            <motion.div
              initial={{ x: "-110%" }}
              animate={{ x: 0 }}
              exit={{ x: "-110%" }}
              transition={{ type: "spring", damping: 32, stiffness: 320 }}
              style={{ position: "fixed", inset: 0, zIndex: 60, pointerEvents: "none" }}
            >
              <div style={{ pointerEvents: "auto" }}>{sidebarContent}</div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    )
  }

  return <div className={cn("hidden lg:flex", isOpen ? "flex" : "hidden")}>{sidebarContent}</div>
}
