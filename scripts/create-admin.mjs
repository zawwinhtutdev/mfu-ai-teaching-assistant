// One-time script to create an admin user account.
// Run with the required variables loaded from your private environment file:
//   node scripts/create-admin.mjs

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const ADMIN_EMAIL = process.env.ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

const missingVariables = Object.entries({
  NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: SUPABASE_ANON_KEY,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
})
  .filter(([, value]) => !value)
  .map(([name]) => name)

if (missingVariables.length > 0) {
  throw new Error(`Missing required environment variables: ${missingVariables.join(", ")}`)
}

async function createAdmin() {
  console.log("Creating admin account...")
  console.log(`Email: ${ADMIN_EMAIL}`)
  console.log("")

  const signUpRes = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      data: { role: "admin", full_name: "MFU Admin" },
    }),
  })

  const signUpData = await signUpRes.json()

  if (signUpRes.ok && signUpData.id) {
    console.log("✓ User created successfully!")
    console.log(`  User ID: ${signUpData.id}`)

    const signInRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      }),
    })

    const signInData = await signInRes.json()

    if (signInData.access_token) {
      console.log("✓ Signed in to update profile")

      const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${signUpData.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${signInData.access_token}`,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ role: "admin", full_name: "MFU Admin" }),
      })

      if (updateRes.ok) {
        console.log("✓ Profile updated to admin role")
      } else {
        console.log("⚠ Could not update profile role (may need manual update in Supabase Dashboard)")
        console.log("  Go to: Supabase Dashboard > Table Editor > profiles")
        console.log(`  Find user ${ADMIN_EMAIL} and set role to 'admin'`)
      }
    }
  } else if (
    signUpData.msg?.includes("already registered") ||
    signUpData.message?.includes("already registered")
  ) {
    console.log("User already exists. Trying to sign in...")

    const signInRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      }),
    })

    const signInData = await signInRes.json()

    if (signInData.access_token) {
      console.log("✓ Signed in successfully with existing credentials")
      console.log(`  User ID: ${signInData.user?.id}`)
    } else {
      console.log("✗ Could not sign in (password may be different)")
      console.log("  Either reset the password or create a new admin account")
    }
  } else {
    console.log("Error creating user:")
    console.log(JSON.stringify(signUpData, null, 2))
  }

  console.log("")
  console.log("=== Admin Login ===")
  console.log("URL: http://localhost:3002/admin/login")
  console.log(`Email: ${ADMIN_EMAIL}`)
  console.log("Password: loaded from ADMIN_PASSWORD")
  console.log("===================")
}

createAdmin().catch(console.error)
