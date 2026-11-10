import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { DEMO_ROLE_COOKIE } from "@/lib/demo-auth"

/** /admin is an entry point: admins go straight to the console, everyone else to the admin login. */
export default async function AdminIndexPage() {
  const cookieStore = await cookies()
  const demoRole = cookieStore.get(DEMO_ROLE_COOKIE)?.value

  redirect(demoRole === "admin" ? "/admin/dashboard" : "/admin/login")
}
