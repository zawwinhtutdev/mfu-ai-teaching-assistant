"use client"

import React, { createContext, useContext, useEffect, useState, useCallback } from "react"
import type { Profile, Course } from "@/lib/types"

interface PortalData {
  profile: Profile
  courses: Course[]
  isLoading: boolean
  refresh: () => Promise<void>
}

const defaultProfile: Profile = {
  id: "",
  email: "",
  full_name: null,
  role: "student",
  avatar_url: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

const PortalContext = createContext<PortalData>({
  profile: defaultProfile,
  courses: [],
  isLoading: true,
  refresh: async () => {},
})

export function usePortalData() {
  return useContext(PortalContext)
}

interface PortalProviderProps {
  initialProfile: Profile
  initialCourses: Course[]
  children: React.ReactNode
}

/**
 * Client-side provider that caches portal data (profile + courses).
 * The initial data comes from the server layout (SSR), so the first render is instant.
 * Subsequent navigations within the portal use the cached client-side state.
 */
export function PortalProvider({ initialProfile, initialCourses, children }: PortalProviderProps) {
  const [profile, setProfile] = useState<Profile>(initialProfile)
  const [courses, setCourses] = useState<Course[]>(initialCourses)
  const [isLoading, setIsLoading] = useState(false)

  // Sync with server data when initial props change (e.g., after revalidation)
  useEffect(() => {
    setProfile(initialProfile)
    setCourses(initialCourses)
  }, [initialProfile, initialCourses])

  const refresh = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/portal-data")
      if (res.ok) {
        const data = await res.json()
        if (data.profile) setProfile(data.profile)
        if (data.courses) setCourses(data.courses)
      }
    } catch {
      // Silently fail — use stale data
    } finally {
      setIsLoading(false)
    }
  }, [])

  return (
    <PortalContext.Provider value={{ profile, courses, isLoading, refresh }}>
      {children}
    </PortalContext.Provider>
  )
}
