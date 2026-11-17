import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import {
  DEMO_EMAIL_COOKIE,
  DEMO_ROLE_COOKIE,
  findDemoAccountByEmail,
  getDefaultRouteForRole,
  isDemoRole,
} from "@/lib/demo-auth"
import { toUserRole } from "@/lib/auth/roles"

const AUTH_PATHS = new Set(["/login", "/signup", "/forgot-password"])
const PUBLIC_PATHS = new Set([
  "/",
  "/llms.txt",
  "/manifest.json",
  "/contact",
  "/feedback",
  "/login",
  "/signup",
  "/signup-success",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
  "/terms",
  // Linked from the signup consent checkbox, so it must be reachable before
  // an account exists.
  "/privacy",
  "/faq",
  "/admin/login",
])

function isTeacherRoute(pathname: string) {
  return pathname.startsWith("/teacherportal") || pathname.startsWith("/dashboard/teacher")
}

function isStudentRoute(pathname: string) {
  return pathname.startsWith("/studentportal")
}

function isAdminRoute(pathname: string) {
  return pathname === "/admin" || (pathname.startsWith("/admin/") && pathname !== "/admin/login")
}

function isAdminLoginPath(pathname: string) {
  return pathname === "/admin/login"
}

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.has(pathname)) {
    return true
  }

  if (pathname === "/docs" || pathname.startsWith("/docs/")) {
    return true
  }

  if (pathname.startsWith("/api")) {
    return true
  }

  return false
}

/** Redirect helper that always drops the incoming query string. */
function redirectTo(request: NextRequest, pathname: string, params?: Record<string, string>) {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  url.search = ""
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value)
    }
  }
  return NextResponse.redirect(url)
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const pathname = request.nextUrl.pathname

  let isAuthenticated = false
  let role: string | null = null
  let isDemoSession = false

  // A demo sign-in is an explicit action and clears any Supabase auth cookies
  // (see /api/demo-auth/login), so demo identity always wins when present.
  // This prevents a stale "student" Supabase session from silently shadowing a
  // fresh admin demo login and bouncing the user back to the student portal.
  const demoRoleValue = request.cookies.get(DEMO_ROLE_COOKIE)?.value
  const demoEmailValue = request.cookies.get(DEMO_EMAIL_COOKIE)?.value
  const demoAccount = findDemoAccountByEmail(demoEmailValue)
  const demoRole =
    demoAccount && isDemoRole(demoRoleValue) && demoAccount.role === demoRoleValue ? demoRoleValue : null

  if (demoRole) {
    isAuthenticated = true
    isDemoSession = true
    role = demoRole
  } else {
    try {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return request.cookies.getAll()
            },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
              supabaseResponse = NextResponse.next({
                request,
              })
              cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
            },
          },
        },
      )

      // PERFORMANCE: Use getSession() instead of getUser() in middleware.
      // getSession() validates the JWT locally (~1ms) without a network call.
      // getUser() makes an HTTP request to Supabase Auth (~200-400ms) on EVERY navigation.
      // For route guarding in middleware, local JWT validation is sufficient.
      // Server components and API routes still use getUser() for full verification.
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (session?.user) {
        isAuthenticated = true
        // Role comes from public.profiles, NOT user_metadata. Metadata is
        // user-writable, so trusting it would let any account self-promote to
        // admin. Reading the row costs one indexed lookup, and the RLS policy
        // "profiles_select_own_or_admin" allows a user to read their own row.
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .maybeSingle()
        role = toUserRole(profile?.role)
      }
    } catch {
      // Supabase is not configured / unreachable (pure demo mode). Treat the
      // visitor as signed out instead of failing the whole request.
    }
  }

  // Signed-out visitors: admin routes go to the admin login, everything else
  // that is not public goes to the shared login.
  if (!isAuthenticated) {
    if (isAdminRoute(pathname)) {
      return redirectTo(request, "/admin/login")
    }

    if (!isPublicPath(pathname)) {
      return redirectTo(request, "/login")
    }

    return supabaseResponse
  }

  // Signed-in visitors.
  if (pathname === "/admin") {
    return redirectTo(request, role === "admin" ? "/admin/dashboard" : "/admin/login")
  }

  if (isAdminLoginPath(pathname)) {
    if (role === "admin") {
      return redirectTo(request, "/admin/dashboard")
    }
    // Show the form plus an "already signed in as..." notice on the page.
    return supabaseResponse
  }

  if (AUTH_PATHS.has(pathname)) {
    return redirectTo(request, getDefaultRouteForRole(role))
  }

  if (pathname === "/dashboard") {
    return redirectTo(request, getDefaultRouteForRole(role))
  }

  // The admin console is never reachable without the admin role. Send the
  // visitor to the admin login with an explanation instead of silently
  // bouncing them back to their own portal.
  if (isAdminRoute(pathname) && role !== "admin") {
    return redirectTo(request, "/admin/login", { denied: "admin" })
  }

  // Demo accounts are shared-preview accounts: they may open the student and
  // teacher surfaces to inspect them. Real accounts keep the strict guards.
  if (!isDemoSession && role) {
    if (isTeacherRoute(pathname) && role !== "teacher") {
      return redirectTo(request, getDefaultRouteForRole(role))
    }

    if (isStudentRoute(pathname) && role !== "student") {
      return redirectTo(request, getDefaultRouteForRole(role))
    }
  }

  return supabaseResponse
}
