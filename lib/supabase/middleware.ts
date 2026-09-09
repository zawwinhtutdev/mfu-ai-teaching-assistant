import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { DEMO_ROLE_COOKIE, getDefaultRouteForRole, isDemoRole } from "@/lib/demo-auth"

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
  return pathname.startsWith("/admin") && pathname !== "/admin/login"
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

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

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

  const pathname = request.nextUrl.pathname

  let isAuthenticated = false
  let role: string | null = null

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
    const user = session.user
    role = user.user_metadata?.role ?? user.app_metadata?.role ?? null
  } else {
    const demoRoleValue = request.cookies.get(DEMO_ROLE_COOKIE)?.value
    if (isDemoRole(demoRoleValue)) {
      isAuthenticated = true
      role = demoRoleValue
    }
  }

  // Admin routes redirect to /admin/login (not the main /login)
  if (!isAuthenticated && isAdminRoute(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = "/admin/login"
    return NextResponse.redirect(url)
  }

  // Authenticated admin users visiting /admin/login get sent to /admin/dashboard
  if (isAuthenticated && isAdminLoginPath(pathname) && role === "admin") {
    const url = request.nextUrl.clone()
    url.pathname = "/admin/dashboard"
    return NextResponse.redirect(url)
  }

  if (!isAuthenticated && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  if (isAuthenticated && AUTH_PATHS.has(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = getDefaultRouteForRole(role)
    return NextResponse.redirect(url)
  }

  if (isAuthenticated && pathname === "/dashboard") {
    const url = request.nextUrl.clone()
    url.pathname = getDefaultRouteForRole(role)
    return NextResponse.redirect(url)
  }

  if (isAuthenticated && role) {
    if (isAdminRoute(pathname) && role !== "admin") {
      const url = request.nextUrl.clone()
      url.pathname = getDefaultRouteForRole(role)
      return NextResponse.redirect(url)
    }

    if (isTeacherRoute(pathname) && role !== "teacher") {
      const url = request.nextUrl.clone()
      url.pathname = getDefaultRouteForRole(role)
      return NextResponse.redirect(url)
    }

    if (isStudentRoute(pathname) && role !== "student") {
      const url = request.nextUrl.clone()
      url.pathname = getDefaultRouteForRole(role)
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
