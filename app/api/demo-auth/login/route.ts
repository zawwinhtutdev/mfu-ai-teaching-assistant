import { NextResponse } from "next/server"
import { DEMO_EMAIL_COOKIE, DEMO_ROLE_COOKIE, findDemoAccount } from "@/lib/demo-auth"

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7

export async function POST(req: Request) {
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

    response.cookies.set(DEMO_ROLE_COOKIE, account.role, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE_SECONDS,
    })

    response.cookies.set(DEMO_EMAIL_COOKIE, account.email, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE_SECONDS,
    })

    return response
  } catch {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 })
  }
}
