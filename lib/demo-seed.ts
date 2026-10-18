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

/** Who teaches which course. */
export const COURSE_OWNER: Record<string, string> = {
  "course-csb321": "teacher-1",
  "course-csd323": "teacher-1",
  "course-csd322": "teacher-2",
  "course-csa411": "teacher-2",
  "course-csm324": "teacher-3",
  "course-gen311": "teacher-3",
  "course-ai-edu": "teacher-3",
}

/** Which courses each student is enrolled in. */
export const ENROLLMENTS: Record<string, string[]> = {
  "student-1": ["course-csb321", "course-csd322", "course-csm324"],
  "student-2": ["course-csb321", "course-csd322"],
  "student-3": ["course-csd323", "course-gen311"],
  "student-4": ["course-csd323", "course-csm324", "course-ai-edu"],
  "student-5": ["course-csd322", "course-csm324"],
  "student-6": ["course-csb321", "course-gen311"],
}

export function teacherById(id: string): SeedTeacher | undefined {
  return DEMO_TEACHERS.find((teacher) => teacher.id === id)
}

export function studentById(id: string): SeedStudent | undefined {
  return DEMO_STUDENTS.find((student) => student.id === id)
}

export function ownerOfCourse(courseId: string): string | undefined {
  return COURSE_OWNER[courseId]
}

export function courseIdsForTeacher(teacherId: string): string[] {
  return Object.entries(COURSE_OWNER)
    .filter(([, owner]) => owner === teacherId)
    .map(([courseId]) => courseId)
}

export function courseIdsForStudent(studentId: string): string[] {
  return ENROLLMENTS[studentId] ?? []
}

export function studentIdsForCourse(courseId: string): string[] {
  return Object.entries(ENROLLMENTS)
    .filter(([, courses]) => courses.includes(courseId))
    .map(([studentId]) => studentId)
}

/** Enrich a student-facing course with the fields the teacher views expect. */
function asTeacherCourse(course: (typeof mockCourses)[number]) {
  return {
    ...course,
    name: course.title,
    department: "School of Information Technology",
    semester: "fall-2025",
    chatbot_tone: "friendly",
    ai_model: "qwen2.5:7b",
    rating: 4.5,
    teacher_id: ownerOfCourse(course.id) ?? "teacher-1",
  }
}

/** Courses for a teacher, in a teacher-portal shape. */
export function coursesForTeacher(teacherId: string) {
  const owned = new Set(courseIdsForTeacher(teacherId))
  const fromTeacherData = mockTeacherCourses.filter((course) => owned.has(course.id))
  const teacherIds = new Set(fromTeacherData.map((course) => course.id))
  const synthesized = mockCourses
    .filter((course) => owned.has(course.id) && !teacherIds.has(course.id))
    .map(asTeacherCourse)
  return [...fromTeacherData, ...synthesized]
}

/** Courses a student is enrolled in. */
export function coursesForStudent(studentId: string) {
  const enrolled = new Set(courseIdsForStudent(studentId))
  return mockCourses.filter((course) => enrolled.has(course.id))
}

export function seedStats() {
  const enrollments = Object.values(ENROLLMENTS).reduce((total, list) => total + list.length, 0)
  const courses = new Set([...mockCourses.map((c) => c.id), ...mockTeacherCourses.map((c) => c.id)])

  return {
    totalUsers: DEMO_TEACHERS.length + DEMO_STUDENTS.length + 1,
    roleCounts: {
      student: DEMO_STUDENTS.length,
      teacher: DEMO_TEACHERS.length,
      admin: 1,
    },
    totalCourses: courses.size,
    totalEnrollments: enrollments,
    totalConversations: 148,
    totalAuditLogs: 326,
    notifications: { queued: 2, processing: 0, sent: 311, failed: 3, canceled: 1 },
    consents: { total: DEMO_STUDENTS.length + DEMO_TEACHERS.length, granted: 7, revoked: 2 },
  }
}
