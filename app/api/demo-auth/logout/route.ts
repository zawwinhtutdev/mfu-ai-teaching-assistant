import { NextResponse } from "next/server"
import { DEMO_EMAIL_COOKIE, DEMO_ROLE_COOKIE } from "@/lib/demo-auth"
import { DEMO_CONVERSATIONS_COOKIE } from "@/lib/demo-conversations"
import { DEMO_DOCUMENTS_COOKIE } from "@/lib/demo-documents"

export async function POST() {
  const response = NextResponse.json({ ok: true })

  response.cookies.set(DEMO_ROLE_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })

  response.cookies.set(DEMO_EMAIL_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })

  response.cookies.set(DEMO_DOCUMENTS_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })

  response.cookies.set(DEMO_CONVERSATIONS_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })

  return response
}
