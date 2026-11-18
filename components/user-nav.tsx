"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Profile } from "@/lib/types"
import { Settings, Home, HelpCircle, MessageSquare, LogOut } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useEffect, useState } from "react"

interface UserNavProps {
  profile?: Profile
}

export function UserNav({ profile: propProfile }: UserNavProps) {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // The portal already resolved this user server-side (Supabase session or
    // demo account); calling Supabase again would fail for demo users.
    if (propProfile) {
      setProfile(propProfile)
      setIsLoading(false)
      return
    }

    const fetchUserProfile = async () => {
      try {
        const supabase = createClient()
        const { data: { user }, error: userError } = await supabase.auth.getUser()

        if (userError || !user) {
          // No session is a normal state here, not an error to surface.
          setProfile(null)
          setIsLoading(false)
          return
        }
        
        if (user) {
          // Fetch profile data from profiles table
          const { data: profileData, error: profileError } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single()

          if (profileError) {
            console.error("Error fetching profile:", profileError)
          }

          if (profileData) {
            console.log("Fetched profile data:", profileData)
            setProfile({
              id: profileData.id,
              email: user.email || profileData.email || "user@mfu.ac.th",
              full_name: profileData.full_name || null,
              role: profileData.role,
              avatar_url: profileData.avatar_url,
              created_at: profileData.created_at,
              updated_at: profileData.updated_at,
            })
          } else {
            // Fallback to user data if profile not found
            console.log("No profile found, using user metadata")
            setProfile({
              id: user.id,
              email: user.email || "user@mfu.ac.th",
              full_name: user.user_metadata?.full_name || null,
              // Never take the role from metadata; lowest privilege on fallback.
              role: "student",
              avatar_url: user.user_metadata?.avatar_url || null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
          }
        } else {
          const demoRes = await fetch("/api/demo-auth/session")
          const demoSession = await demoRes.json()

          if (demoSession?.isDemo && demoSession?.account) {
            setProfile({
              id: demoSession.account.profileId,
              email: demoSession.account.email,
              full_name: demoSession.account.fullName,
              role: demoSession.account.role,
              avatar_url: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
          } else if (propProfile) {
            // No user logged in, use prop profile if available
            console.log("No user logged in, using prop profile")
            setProfile(propProfile)
          }
        }
      } catch (error) {
        console.error("Error fetching user profile:", error)
        // Fallback to prop profile if fetch fails
        if (propProfile) {
          console.log("Using prop profile as fallback")
          setProfile(propProfile)
        }
      } finally {
        setIsLoading(false)
      }
    }

    // Always fetch real user data
    fetchUserProfile()
  }, [propProfile])

  const handleGoHome = () => {
    router.push("/")
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await fetch("/api/demo-auth/logout", { method: "POST" })
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  // Show loading state or use fallback
  if (isLoading || !profile) {
    return (
      <Button variant="ghost" className="relative h-10 w-10 rounded-full" disabled>
        <Avatar>
          <AvatarFallback className="text-[#A81D24] dark:text-[#A81D24]">...</AvatarFallback>
        </Avatar>
      </Button>
    )
  }

  const initials =
    profile.full_name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() || profile.email[0].toUpperCase()

  const settingsPath = profile.role === "student" ? "/studentportal/settings" : "/teacherportal/settings"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar>
            {profile.avatar_url ? (
              <AvatarImage src={profile.avatar_url} alt={profile.full_name || "Profile picture"} />
            ) : null}
            <AvatarFallback className="text-[#A81D24] dark:text-[#A81D24]">{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{profile.full_name?.trim() || profile.email?.split("@")[0] || "User"}</p>
            <p className="text-xs leading-none text-gray-600 dark:text-gray-400">{profile.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="text-foreground">
          <Link href={settingsPath}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="text-foreground">
          <Link href="/faq">
            <HelpCircle className="mr-2 h-4 w-4" />
            Help
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="text-foreground">
          <Link href="/feedback">
            <MessageSquare className="mr-2 h-4 w-4" />
            Feedback
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleGoHome} className="text-foreground">
          <Home className="mr-2 h-4 w-4" />
          Go to Home
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleLogout} className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300">
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
