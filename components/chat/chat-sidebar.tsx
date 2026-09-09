"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { MessageSquarePlus, User, BookOpen, MessageSquare, X, Building, MapPin, ChevronDown, Sparkles, Files } from "lucide-react"
import { useState, useEffect } from "react"
import { ProfileButton } from "@/components/animate-ui/components/profile/profile-button"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { BrandIcon } from "@/components/brand-icon"

interface ChatSidebarProps {
  isOpen?: boolean
  onClose?: () => void
  isMobile?: boolean
}

export function ChatSidebar({ isOpen = true, onClose, isMobile = false }: ChatSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [authRole, setAuthRole] = useState<"student" | "teacher" | "admin" | null>(null)
  const [conversations, setConversations] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [userProfile, setUserProfile] = useState({
    name: "Student",
    email: "student@mfu.ac.th",
    role: "Student Mode"
  })
  const [mfuCampusOpen, setMfuCampusOpen] = useState(false)

  useEffect(() => {
    // Fetch conversations
    fetch("/api/conversations")
      .then(async (res) => {
        // Handle both successful and error responses
        const data = await res.json()
        if (data.conversations) {
          setConversations(data.conversations)
        } else {
          setConversations([])
        }
        setIsLoading(false)
      })
      .catch((error) => {
        console.error("[v0] Error loading conversations:", error)
        setConversations([])
        setIsLoading(false)
      })

    // Fetch user profile data
    const fetchUserProfile = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        
        if (user) {
          // Fetch profile data from profiles table
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
            // Fallback to user data if profile not found
            const metadataRole =
              user.user_metadata?.role === "teacher" || user.user_metadata?.role === "admin"
                ? user.user_metadata.role
                : "student"
            setAuthRole(metadataRole)
            setUserProfile({
              name: user.user_metadata?.full_name || "User",
              email: user.email || "user@mfu.ac.th",
              role:
                metadataRole === "teacher"
                  ? "Teacher Mode"
                  : metadataRole === "admin"
                    ? "Admin Mode"
                    : "Student Mode",
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
            // Default values for unauthenticated users
            setAuthRole(null)
            setUserProfile({
              name: "Guest",
              email: "guest@mfu.ac.th",
              role: "Student Mode"
            })
          }
        }
      } catch (error) {
        console.error("[v0] Error fetching user profile:", error)
        // Keep default values on error
      }
    }

    fetchUserProfile()
  }, [pathname])

  const showStudentPortal = authRole !== "teacher"
  const showTeacherPortal = authRole !== "student"

  const sidebarContent = (
    <div className="flex h-full w-64 sm:w-72 lg:w-64 flex-col border-r bg-card">
      {/* Header */}
      <div className="flex h-16 items-center gap-2 border-b px-3 sm:px-4">
        <BrandIcon size={24} className="shrink-0 rounded-full" />
        <span className="text-base sm:text-lg font-semibold truncate">MFU AI Assistant</span>
        {isMobile && onClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="ml-auto h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* New Chat Button */}
      <div className="p-3 sm:p-4">
        <Button 
          className="w-full" 
          size="sm"
          onClick={() => {
            // Navigate to new chat - just use router.push, no need for reload
            router.push('/chat')
            // Close mobile sidebar if open
            if (isMobile && onClose) {
              onClose()
            }
          }}
        >
          <MessageSquarePlus className="mr-2 h-4 w-4" />
          New Chat
        </Button>
      </div>

      <Separator />

      {/* Navigation Links */}
      <div className="space-y-1 p-3 sm:p-4">
        {showStudentPortal && (
          <Button
            asChild
            variant={pathname.startsWith("/studentportal") ? "secondary" : "ghost"}
            className="w-full justify-start"
            size="sm"
          >
            <Link href="/studentportal" target="_blank" rel="noopener noreferrer">
              <User className="mr-2 h-4 w-4 text-[#A81D24]" />
              Student Portal
            </Link>
          </Button>
        )}
        {showTeacherPortal && (
          <Button
            asChild
            variant={pathname.startsWith("/teacherportal") ? "secondary" : "ghost"}
            className="w-full justify-start"
            size="sm"
          >
            <Link href="/teacherportal" target="_blank" rel="noopener noreferrer">
              <BookOpen className="mr-2 h-4 w-4 text-[#A81D24]" />
              Teacher Portal
            </Link>
          </Button>
        )}
        <Button
          asChild
          variant={pathname.startsWith("/ai-agents") ? "secondary" : "ghost"}
          className="w-full justify-start"
          size="sm"
        >
          <Link href="/ai-agents">
            <Sparkles className="mr-2 h-4 w-4 text-[#A81D24]" />{/* If Sparkles is not imported, use MessageSquarePlus */}
            AI Agents
          </Link>
        </Button>
        <Button
          asChild
          variant={pathname.startsWith("/chat/documents") ? "secondary" : "ghost"}
          className="w-full justify-start"
          size="sm"
        >
          <Link href="/chat/documents">
            <Files className="mr-2 h-4 w-4 text-[#A81D24]" />
            Documents RAG
          </Link>
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start"
          size="sm"
          onClick={() => setMfuCampusOpen((v) => !v)}
          aria-expanded={mfuCampusOpen}
        >
          <Building className="mr-2 h-4 w-4 text-[#A81D24]" />
          MFU Daily
          <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${mfuCampusOpen ? "rotate-180" : "rotate-0"}`} />
        </Button>
        {mfuCampusOpen && (
          <div className="pl-8 py-1 flex flex-col gap-1">
            <a href="https://teams.microsoft.com/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:underline">
              Microsoft Teams
            </a>
            <a href="https://meet.google.com/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:underline">
              Google Meet
            </a>
            <a href="https://classroom.google.com/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:underline">
              Google Classroom
            </a>
            <a href="https://en.mfu.ac.th/home.html" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:underline">
              MFU Main Website
            </a>
            <a href="https://reg.mfu.ac.th/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:underline">
              MFU Reg
            </a>
          </div>
        )}
      </div>

      <Separator />

      {/* Conversation History */}
      <div className="flex-1 overflow-hidden">
        <div className="p-3 sm:p-4 pb-2">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Conversation History</h3>
        </div>
        <ScrollArea className="h-[calc(100%-3rem)] px-3 sm:px-4">
          <div className="space-y-1 pb-4">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-gray-600 dark:text-gray-400">Loading...</div>
            ) : conversations.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-600 dark:text-gray-400">No conversations yet</div>
            ) : (
              conversations.map((conv) => (
                <Button
                  key={conv.id}
                  asChild
                  variant={pathname === `/chat/${conv.id}` ? "secondary" : "ghost"}
                  className="w-full justify-start text-left"
                  size="sm"
                >
                  <Link href={`/chat/${conv.id}`}>
                    <MessageSquare className="mr-2 h-4 w-4 shrink-0" />
                    <div className="flex-1 truncate">
                      <div className="truncate text-sm font-medium">{conv.title}</div>
                      <div className="truncate text-xs text-gray-600 dark:text-gray-400">
                        {new Date(conv.updated_at).toLocaleDateString()}
                      </div>
                    </div>
                  </Link>
                </Button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Profile Button - Bottom of Sidebar */}
      <div className="border-t p-3 sm:p-4">
        <ProfileButton
          userName={userProfile.email.split('@')[0]}
          userEmail={userProfile.email}
          userRole={userProfile.role}
          onProfileClick={() => console.log("Profile clicked")}
          onSettingsClick={() => console.log("Settings clicked")}
          onLogoutClick={async () => {
            // Handle logout
            const supabase = createClient()
            await fetch("/api/demo-auth/logout", { method: "POST" })
            await supabase.auth.signOut()
            router.push("/")
            router.refresh()
          }}
          onTokenUsageClick={() => {
            // Do nothing - Token Usage is disabled
          }}
          onFeedbackClick={() => {
            // Feedback is now handled by the modal in ProfileButton
            console.log("Feedback clicked")
          }}
        />
      </div>
    </div>
  )

  if (isMobile) {
    return (
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Mobile Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
              onClick={onClose}
            />
            {/* Mobile Sidebar */}
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed left-0 top-0 z-50 h-full w-72 sm:w-80 lg:hidden"
            >
              {sidebarContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    )
  }

  return (
    <div className={cn(
      "hidden lg:flex",
      isOpen ? "flex" : "hidden"
    )}>
      {sidebarContent}
    </div>
  )
}
