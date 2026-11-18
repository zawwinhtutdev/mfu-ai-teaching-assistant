/**
 * Production-shaped demo dataset.
 *
 * Instead of one hard-coded teacher/student, the demo has three teachers, six
 * students and seven courses with real ownership and enrollment relationships.
 * Every portal derives its view from these relationships, so switching accounts
 * changes what you can see — the same way a real deployment behaves.
 *
 * Course objects themselves still come from mock-data.ts so existing materials,
 * quizzes and flashcards keep resolving.
 */

import { mockCourses, mockTeacherCourses } from "@/lib/mock-data"

export interface SeedTeacher {
  id: string
  fullName: string
  email: string
  department: string
  /** Course codes this teacher owns. Drives chat access in demo sessions. */
  courseCodes: string[]
}

export interface SeedStudent {
  id: string
  fullName: string
  email: string
  year: number
  /** Course codes this student is enrolled in. Drives chat access in demo sessions. */
  courseCodes: string[]
}

export const DEMO_TEACHERS: SeedTeacher[] = [
  {
    id: "teacher-1",
    fullName: "Dr. Anan Suwan",
    email: "anan.suwan@mfu.ac.th",
    department: "School of Information Technology",
    // These must match `COURSES` in services/api/scripts/seed_academic.py,
    // because that service supplies the course list shown in the demo portal.
    // If the portal lists a course this array does not claim, the teacher sees
    // the course but every detail request is refused — which is exactly what
    // happened when AI-EDU was reassigned here.
    courseCodes: ["CSB321", "CSD323"],
  },
  {
    id: "teacher-2",
    fullName: "Dr. Malee Chaiyaporn",
    email: "malee.chaiyaporn@mfu.ac.th",
    department: "School of Information Technology",
    courseCodes: ["CSD322", "CSA411"],
  },
  {
    id: "teacher-3",
    fullName: "Ajarn Somchai Prasert",
    email: "somchai.prasert@mfu.ac.th",
    department: "School of Management",
    courseCodes: ["CSM324", "GEN311", "AI-EDU"],
  },
]

/**
 * Demo students.
 *
 * These must be accounts that actually exist in `auth.users`, because the login
 * page and every portal now authenticate against Supabase. The previous entries
 * used invented addresses (`kanya.wong@mfu.ac.th`) that only worked through the
 * removed demo-cookie shortcut, so clicking them signed you in as an identity
 * that had no profile row and therefore no courses.
 *
 * The IDs and course lists mirror `ENROLLMENTS` in
 * services/api/scripts/seed_academic.py, which is where the demo portal gets
 * its course list from.
 */
export const DEMO_STUDENTS: SeedStudent[] = [
  { id: "student-1", fullName: "Kanya Wong", email: "6631503078@lamduan.mfu.ac.th", year: 3, courseCodes: ["CSB321", "CSD322", "CSM324"] },
  { id: "student-2", fullName: "Niran Chai", email: "6631503085@lamduan.mfu.ac.th", year: 3, courseCodes: ["CSB321", "CSD322"] },
  { id: "student-3", fullName: "Pim Srisuk", email: "6631503092@lamduan.mfu.ac.th", year: 2, courseCodes: ["CSD323", "GEN311"] },
  { id: "student-4", fullName: "Thanakorn Roj", email: "6631503101@lamduan.mfu.ac.th", year: 4, courseCodes: ["CSD323", "CSM324", "AI-EDU"] },
  { id: "student-5", fullName: "Araya Kitt", email: "6631503118@lamduan.mfu.ac.th", year: 2, courseCodes: ["CSD322", "CSM324"] },
  { id: "student-6", fullName: "Krit Phan", email: "6631503125@lamduan.mfu.ac.th", year: 4, courseCodes: ["CSB321", "GEN311"] },
]

export function teacherById(id: string): SeedTeacher | undefined {
  return DEMO_TEACHERS.find((teacher) => teacher.id === id)
}

export function studentById(id: string): SeedStudent | undefined {
  return DEMO_STUDENTS.find((student) => student.id === id)
}
