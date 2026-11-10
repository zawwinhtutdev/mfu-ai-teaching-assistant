import { cookies } from "next/headers"

import { createClient } from "@/lib/supabase/server"

const API_URL = process.env.API_SERVICE_URL?.replace(/\/+$/, "")

export interface ApiCourse {
  id: string
  code: string
  title: string
  description: string | null
  semester: string
  teacher_id: string
  teacher_name: string | null
  enrolled_students: number
  documents?: number
  documents_ready?: number
  created_at: string
}

async function callerHeaders(): Promise<Record<string, string> | null> {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (session?.access_token) {
    return { Authorization: `Bearer ${session.access_token}` }
  }

  if (process.env.ALLOW_INSECURE_DEV_AUTH === "true") {
    const jar = await cookies()
    const email = jar.get("mfu_demo_email")?.value
    if (email) {
      return { "X-Dev-Principal": email }
    }
  }

  return null
}

/**
 * Courses for the signed-in person, straight from the service database.
 *
 * The service decides what this caller may see (teacher: own courses, student:
 * enrolled courses, admin: all), so the UI never filters by itself.
 */
export async function fetchMyCourses(): Promise<ApiCourse[]> {
  if (!API_URL) {
    return []
  }

  const headers = await callerHeaders()
  if (!headers) {
    return []
  }

  try {
    const response = await fetch(`${API_URL}/v1/me/courses`, {
      headers,
      cache: "no-store",
    })
    if (!response.ok) {
      return []
    }
    return (await response.json()) as ApiCourse[]
  } catch {
    // The service is a hard dependency; a network error means no courses.
    return []
  }
}

/** Platform statistics, admin only (the service enforces the role). */
export async function fetchPlatformStats(): Promise<Record<string, unknown> | null> {
  if (!API_URL) return null
  const headers = await callerHeaders()
  if (!headers) return null

  try {
    const response = await fetch(`${API_URL}/v1/stats`, { headers, cache: "no-store" })
    if (!response.ok) return null
    return (await response.json()) as Record<string, unknown>
  } catch {
    return null
  }
}
