import { createClient } from "@/lib/supabase/server"
import {
  DEMO_EMAIL_COOKIE,
  DEMO_ROLE_COOKIE,
  getDefaultRouteForRole,
  getDemoAccountByRole,
  isDemoRole,
} from "@/lib/demo-auth"
import { cookies } from "next/headers"

export interface EducveInitialAuthState {
  isAuthenticated: boolean
  portalHref: string
  role: string | null
}

const anonymousState: EducveInitialAuthState = {
  isAuthenticated: false,
  portalHref: "/chat",
  role: null,
}

export async function getInitialEducveAuthState(): Promise<EducveInitialAuthState> {
  const cookieStore = await cookies()
  const demoRole = cookieStore.get(DEMO_ROLE_COOKIE)?.value
  const demoEmail = cookieStore.get(DEMO_EMAIL_COOKIE)?.value

  if (isDemoRole(demoRole)) {
    const demoAccount = getDemoAccountByRole(demoRole)

    if (demoAccount && demoEmail?.toLowerCase() === demoAccount.email.toLowerCase()) {
      return {
        isAuthenticated: true,
        portalHref: getDefaultRouteForRole(demoRole),
        role: demoRole,
      }
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return anonymousState
  }

  let role = user.user_metadata?.role ?? user.app_metadata?.role ?? null

  if (!role) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    role = profile?.role ?? null
  }

  return {
    isAuthenticated: true,
    portalHref: getDefaultRouteForRole(role),
    role,
  }
}
