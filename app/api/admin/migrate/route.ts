import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdminUser } from "@/lib/server/admin-auth"

// One-time migration: add 'admin' to the profiles role constraint
// DELETE THIS FILE after running it once
export async function POST() {
  try {
    const admin = await requireAdminUser()
    if (!admin.user || !admin.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // Use the Supabase management/pg endpoint
    const pgUrl = url.replace('.supabase.co', '.supabase.co')
    
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      db: { schema: 'public' }
    })

    // Try to update the constraint by calling a raw SQL function
    // We need to create an RPC function first
    const { error: rpcError } = await client.rpc('exec_sql', {
      sql_query: `
        ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
        ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('student', 'teacher', 'admin'));
      `
    })

    if (rpcError) {
      // RPC might not exist, provide manual instructions
      return NextResponse.json({
        error: "Cannot run migration automatically",
        manual_steps: [
          "1. Go to Supabase Dashboard → SQL Editor",
          "2. Run this SQL:",
          "ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;",
          "ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('student', 'teacher', 'admin'));",
          "3. Then promote a user:",
          "UPDATE profiles SET role = 'admin' WHERE email = 'admin@mfu.ac.th';",
        ],
        rpc_error: rpcError.message,
      })
    }

    // Now promote the admin user
    const { error: updateError } = await client
      .from('profiles')
      .update({ role: 'admin' })
      .eq('email', 'admin@mfu.ac.th')

    return NextResponse.json({
      success: true,
      message: "admin@mfu.ac.th promoted to admin role",
      updateError: updateError?.message || null,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}
