export type DemoRole = "student" | "teacher" | "admin"

export interface DemoAccount {
  role: DemoRole
  email: string
  password: string
  fullName: string
  profileId: string
}

export const DEMO_ROLE_COOKIE = "mfu_demo_role"
export const DEMO_EMAIL_COOKIE = "mfu_demo_email"

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    role: "student",
    email: "demo.student@mfu.ac.th",
    password: "demo1234",
    fullName: "Demo Student",
    profileId: "mock-student-1",
  },
  {
    role: "teacher",
    email: "demo.teacher@mfu.ac.th",
    password: "demo1234",
    fullName: "Demo Teacher",
    profileId: "mock-teacher-1",
  },
  {
    role: "admin",
    email: "admin@mfu.ac.th",
    password: "admin1234",
    fullName: "MFU Admin",
    profileId: "mock-admin-1",
  },
]

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

export function isDemoRole(value: string | null | undefined): value is DemoRole {
  return value === "student" || value === "teacher" || value === "admin"
}

export function findDemoAccount(email: string, password: string): DemoAccount | null {
  const normalized = normalizeEmail(email)
  return (
    DEMO_ACCOUNTS.find((account) => normalizeEmail(account.email) === normalized && account.password === password) ||
    null
  )
}

export function getDemoAccountByRole(role: string | null | undefined): DemoAccount | null {
  if (!isDemoRole(role)) {
    return null
  }

  return DEMO_ACCOUNTS.find((account) => account.role === role) || null
}

export function getDefaultRouteForRole(role: string | null | undefined) {
  if (role === "admin") {
    return "/admin/dashboard"
  }

  if (role === "teacher") {
    return "/teacherportal"
  }

  if (role === "student") {
    return "/studentportal/mycourses"
  }

  return "/chat"
}
