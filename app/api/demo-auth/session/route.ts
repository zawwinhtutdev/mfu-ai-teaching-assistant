import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { DEMO_EMAIL_COOKIE, DEMO_ROLE_COOKIE, getDemoAccountByRole } from "@/lib/demo-auth"

export async function GET() {
  const cookieStore = await cookies()
  const role = cookieStore.get(DEMO_ROLE_COOKIE)?.value
  const email = cookieStore.get(DEMO_EMAIL_COOKIE)?.value
  const account = getDemoAccountByRole(role)

  if (!account || !email || email.toLowerCase() !== account.email.toLowerCase()) {
    return NextResponse.json({ isDemo: false })
  }

  return NextResponse.json({
    isDemo: true,
    account: {
      role: account.role,
      email: account.email,
      fullName: account.fullName,
      profileId: account.profileId,
    },
  })
}
