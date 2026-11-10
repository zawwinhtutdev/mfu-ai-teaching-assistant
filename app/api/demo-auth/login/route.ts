import { NextResponse, type NextRequest } from "next/server"
import { isHttpsRequest } from "@/lib/server/request-security"
import { DEMO_EMAIL_COOKIE, DEMO_ROLE_COOKIE, findDemoAccount } from "@/lib/demo-auth"

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const email = typeof body?.email === "string" ? body.email : ""
    const password = typeof body?.password === "string" ? body.password : ""

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }

    const account = findDemoAccount(email, password)

    if (!account) {
      return NextResponse.json({ error: "Invalid demo credentials" }, { status: 401 })
    }

    const response = NextResponse.json({
      account: {
        role: account.role,
        email: account.email,
        fullName: account.fullName,
      },
    })

    // A demo sign-in must replace any real Supabase session. Otherwise the
    // middleware/session helpers (which accept a Supabase user) would keep the
    // old role and silently bounce the user to their previous portal.
    for (const cookie of req.cookies.getAll()) {
      if (cookie.name.startsWith("sb-")) {
        response.cookies.set(cookie.name, "", {
          path: "/",
          maxAge: 0,
        })
      }
    }

    response.cookies.set(DEMO_ROLE_COOKIE, account.role, {
      httpOnly: true,
      secure: await isHttpsRequest(),
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE_SECONDS,
    })

    response.cookies.set(DEMO_EMAIL_COOKIE, account.email, {
      httpOnly: true,
      secure: await isHttpsRequest(),
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE_SECONDS,
    })

    return response
  } catch {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 })
  }
}
