import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ enabled: false }, { status: 503 })
  }

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: anonKey },
      cache: "no-store",
    })

    if (!response.ok) {
      return NextResponse.json({ enabled: false }, { status: 503 })
    }

    const settings = await response.json()
    return NextResponse.json({ enabled: settings.external?.google === true })
  } catch {
    return NextResponse.json({ enabled: false }, { status: 503 })
  }
}
