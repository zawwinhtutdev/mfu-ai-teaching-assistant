import { DEMO_STUDENTS, DEMO_TEACHERS } from "@/lib/demo-seed"

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

const TEACHER_PASSWORD = "teacher1234"
const STUDENT_PASSWORD = "student1234"

export const DEMO_ACCOUNTS: DemoAccount[] = [
  ...DEMO_TEACHERS.map((teacher) => ({
    role: "teacher" as const,
    email: teacher.email,
    password: TEACHER_PASSWORD,
    fullName: teacher.fullName,
    profileId: teacher.id,
  })),
  ...DEMO_STUDENTS.slice(0, 4).map((student) => ({
    role: "student" as const,
    email: student.email,
    password: STUDENT_PASSWORD,
    fullName: student.fullName,
    profileId: student.id,
  })),
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

/** Resolve the account for a specific signed-in demo user. */
export function findDemoAccountByEmail(email: string | null | undefined): DemoAccount | null {
  if (!email) {
    return null
  }
  const normalized = normalizeEmail(email)
  return DEMO_ACCOUNTS.find((account) => normalizeEmail(account.email) === normalized) || null
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
