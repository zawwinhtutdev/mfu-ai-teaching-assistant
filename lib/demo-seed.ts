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
}

export interface SeedStudent {
  id: string
  fullName: string
  email: string
  year: number
}

export const DEMO_TEACHERS: SeedTeacher[] = [
  {
    id: "teacher-1",
    fullName: "Dr. Anan Suwan",
    email: "anan.suwan@mfu.ac.th",
    department: "School of Information Technology",
  },
  {
    id: "teacher-2",
    fullName: "Dr. Malee Chaiyaporn",
    email: "malee.chaiyaporn@mfu.ac.th",
    department: "School of Information Technology",
  },
  {
    id: "teacher-3",
    fullName: "Ajarn Somchai Prasert",
    email: "somchai.prasert@mfu.ac.th",
    department: "School of Management",
  },
]

export const DEMO_STUDENTS: SeedStudent[] = [
  { id: "student-1", fullName: "Kanya Wong", email: "kanya.wong@mfu.ac.th", year: 3 },
  { id: "student-2", fullName: "Niran Chai", email: "niran.chai@mfu.ac.th", year: 3 },
  { id: "student-3", fullName: "Pim Srisuk", email: "pim.srisuk@mfu.ac.th", year: 2 },
  { id: "student-4", fullName: "Thanakorn Roj", email: "thanakorn.roj@mfu.ac.th", year: 4 },
  { id: "student-5", fullName: "Araya Kitt", email: "araya.kitt@mfu.ac.th", year: 2 },
  { id: "student-6", fullName: "Krit Phan", email: "krit.phan@mfu.ac.th", year: 4 },
]

export function teacherById(id: string): SeedTeacher | undefined {
  return DEMO_TEACHERS.find((teacher) => teacher.id === id)
}

export function studentById(id: string): SeedStudent | undefined {
  return DEMO_STUDENTS.find((student) => student.id === id)
}
