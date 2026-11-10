import { cache } from "react"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import {
  DEMO_EMAIL_COOKIE,
  DEMO_ROLE_COOKIE,
  findDemoAccountByEmail,
  isDemoRole,
  type DemoAccount,
  type DemoRole,
} from "@/lib/demo-auth"
import { studentById, teacherById } from "@/lib/demo-seed"
import { fetchMyCourses } from "@/lib/server/academic"
import {
  mockCourses,
  mockMaterials,
  mockQueries,
  mockStudentProfile,
  mockTeacherCourses,
  mockTeacherProfile,
} from "@/lib/mock-data"
import type { ChatbotSettings, Course, CourseEnrollmentFeedback, CourseMaterial, Profile, UserRole } from "@/lib/types"
import { slugify } from "@/lib/utils"
import { toUserRole } from "@/lib/auth/roles"

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

interface SessionContext {
  isDemo: boolean
  role: UserRole
  userId: string
  profile: Profile
  supabase: SupabaseClient | null
}

function demoProfileFor(account: DemoAccount): Profile {
  const now = new Date().toISOString()
  const teacher = teacherById(account.profileId)
  const student = studentById(account.profileId)
  return {
    id: account.profileId,
    email: account.email,
    full_name: teacher?.fullName ?? student?.fullName ?? account.fullName,
    role: account.role,
    avatar_url: null,
    created_at: now,
    updated_at: now,
  }
}

function toProfileFromRow(row: any, fallbackEmail: string): Profile {
  const role: UserRole = row?.role === "teacher" ? "teacher" : row?.role === "admin" ? "admin" : "student"
  return {
    id: row?.id,
    email: row?.email || fallbackEmail,
    full_name: row?.full_name ?? null,
    role,
    avatar_url: row?.avatar_url ?? null,
    created_at: row?.created_at || new Date().toISOString(),
    updated_at: row?.updated_at || new Date().toISOString(),
  }
}

const getSessionContext = cache(async (): Promise<SessionContext> => {
  const cookieStore = await cookies()
  const demoRoleValue = cookieStore.get(DEMO_ROLE_COOKIE)?.value
  const demoEmail = cookieStore.get(DEMO_EMAIL_COOKIE)?.value

  if (isDemoRole(demoRoleValue)) {
    const demoAccount = findDemoAccountByEmail(demoEmail)

    if (demoAccount && demoAccount.role === demoRoleValue) {
      return {
        isDemo: true,
        role: demoRoleValue,
        userId: demoAccount.profileId,
        profile: demoProfileFor(demoAccount),
        supabase: null,
      }
    }
  }

  const supabase = await createClient()
  // PERFORMANCE: Use getSession() instead of getUser() to avoid ~200-400ms
  // network round-trip on every navigation. Middleware already validates/refreshes tokens.
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user) {
    return {
      isDemo: false,
      role: "student",
      userId: "",
      profile: {
        id: "",
        email: "",
        full_name: null,
        role: "student",
        avatar_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      supabase: null,
    }
  }

  const user = session.user
  const { data: profileRow } = await supabase.from("profiles").select("*").eq("id", user.id).single()
  // Role comes from public.profiles only. user_metadata is user-writable, so
  // reading it here would let an account promote itself client-side.
  const role: UserRole = toUserRole(profileRow?.role)

  return {
    isDemo: false,
    role,
    userId: user.id,
    profile: toProfileFromRow(
      {
        ...profileRow,
        id: user.id,
        email: profileRow?.email || user.email,
        role,
      },
      user.email || "",
    ),
    supabase,
  }
})

async function getTeacherCoursesReal(supabase: SupabaseClient, teacherId: string): Promise<Course[]> {
  const { data } = await supabase.from("courses").select("*").eq("teacher_id", teacherId).order("created_at")
  return (data || []) as Course[]
}

async function getStudentCoursesReal(supabase: SupabaseClient, studentId: string): Promise<Course[]> {
  const { data: enrollments } = await supabase
    .from("course_enrollments")
    .select("course_id,courses(*)")
    .eq("student_id", studentId)

  const coursesFromEnrollment = (enrollments || [])
    .map((enrollment: any) => enrollment.courses)
    .filter(Boolean) as Course[]

  if (coursesFromEnrollment.length > 0) {
    return coursesFromEnrollment
  }

  return []
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export async function enrollStudentByCourseCode(rawCourseCode: string): Promise<CourseEnrollmentFeedback> {
  const courseCode = rawCourseCode.trim()

  if (!courseCode) {
    return {
      status: "error",
      message: "Missing enrollment code.",
    }
  }

  const context = await getSessionContext()
  if (context.isDemo) {
    return {
      status: "error",
      message: "Demo accounts cannot enroll in real courses.",
    }
  }

  if (!context.supabase || !context.userId || context.role !== "student") {
    return {
      status: "error",
      message: "You must be signed in as a student to enroll.",
    }
  }

  const supabase = context.supabase
  const normalizedCode = courseCode.toUpperCase()

  let { data: course } = await supabase
    .from("courses")
    .select("id,title,code")
    .eq("code", normalizedCode)
    .maybeSingle()

  if (!course && normalizedCode !== courseCode) {
    const { data: courseByRawCode } = await supabase
      .from("courses")
      .select("id,title,code")
      .eq("code", courseCode)
      .maybeSingle()
    course = courseByRawCode || null
  }

  if (!course && isUuid(courseCode)) {
    const { data: courseById } = await supabase
      .from("courses")
      .select("id,title,code")
      .eq("id", courseCode)
      .maybeSingle()
    course = courseById || null
  }

  if (!course) {
    return {
      status: "error",
      message: "Course not found. Please check the enrollment link.",
    }
  }

  const { error } = await supabase.from("course_enrollments").insert({
    course_id: course.id,
    student_id: context.userId,
  })

  if (error && error.code !== "23505") {
    return {
      status: "error",
      message: "Could not enroll right now. Please try again.",
    }
  }

  if (error?.code === "23505") {
    return {
      status: "success",
      message: `You are already enrolled in ${course.title}.`,
    }
  }

  return {
    status: "success",
    message: `Enrolled in ${course.title} (${course.code}).`,
  }
}

async function getCourseMaterialsReal(supabase: SupabaseClient, courseIds: string[]): Promise<CourseMaterial[]> {
  if (courseIds.length === 0) {
    return []
  }

  const { data } = await supabase.from("course_materials").select("*").in("course_id", courseIds).order("created_at")
  return (data || []) as CourseMaterial[]
}

async function getCourseChatbotSettingReal(supabase: SupabaseClient, courseId: string): Promise<ChatbotSettings | null> {
  const { data } = await supabase.from("chatbot_settings").select("*").eq("course_id", courseId).single()
  return (data || null) as ChatbotSettings | null
}

export async function getStudentPortalData() {
  const context = await getSessionContext()

  if (context.isDemo) {
    return {
      ...context,
      courses: (await fetchMyCourses()) as unknown as Course[],
    }
  }

  if (!context.supabase || !context.userId) {
    return {
      ...context,
      courses: [],
    }
  }

  const courses = await getStudentCoursesReal(context.supabase!, context.userId)

  return {
    ...context,
    courses,
  }
}

export async function getTeacherPortalData() {
  const context = await getSessionContext()

  if (context.isDemo) {
    const apiCourses = await fetchMyCourses()
    const owned = new Set(apiCourses.map((course) => course.id))
    return {
      ...context,
      courses: apiCourses.map((course) => ({
        ...course,
        name: course.title,
        department: "School of Information Technology",
        semester: course.semester,
        chatbot_tone: "friendly",
        ai_model: "qwen2.5:7b",
        rating: 4.5,
        updated_at: course.created_at,
      })) as any,
      queries: mockQueries.filter((query: { course_id: string }) => owned.has(query.course_id)),
    }
  }

  if (!context.supabase || !context.userId) {
    return {
      ...context,
      courses: [],
      queries: [],
    }
  }

  const [courses, queriesResult] = await Promise.all([
    getTeacherCoursesReal(context.supabase!, context.userId),
    (async () => {
      // We need courseIds first, so we fetch courses first
      // But we can at least avoid re-fetching the session
      return null
    })()
  ])
  const courseIds = courses.map((course) => course.id)

  let queries: any[] = []
  if (courseIds.length > 0) {
    const { data } = await context.supabase!.from("student_queries").select("*").in("course_id", courseIds)
    queries = data || []
  }

  return {
    ...context,
    courses,
    queries,
  }
}

export async function getChatData() {
  const context = await getSessionContext()

  if (context.isDemo) {
    if (context.role === "teacher") {
      const materials = mockMaterials.filter((material) =>
        mockTeacherCourses.some((course) => course.id === material.course_id),
      )

      return {
        ...context,
        courses: mockTeacherCourses,
        materials,
      }
    }

    return {
      ...context,
      courses: mockCourses,
      materials: mockMaterials,
    }
  }

  if (!context.supabase || !context.userId) {
    return {
      ...context,
      courses: [],
      materials: [],
    }
  }

  const courses =
    context.role === "teacher"
      ? await getTeacherCoursesReal(context.supabase!, context.userId)
      : await getStudentCoursesReal(context.supabase!, context.userId)

  const materials = await getCourseMaterialsReal(
    context.supabase!,
    courses.map((course) => course.id),
  )

  return {
    ...context,
    courses,
    materials,
  }
}

export async function getStudentCourseById(courseId: string) {
  const data = await getStudentPortalData()

  const course = data.courses.find((item: { id: string }) => item.id === courseId)
  if (!course) {
    return null
  }

  if (data.isDemo) {
    return {
      ...data,
      course,
      materials: mockMaterials.filter((material) => material.course_id === course.id),
      chatbotSettings: {
        id: `mock-chatbot-setting-${course.id}`,
        course_id: course.id,
        tone: (course as any).chatbot_tone || "friendly",
        ai_model: (course as any).ai_model || "google/gemini-3.8-flash",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as ChatbotSettings,
    }
  }

  const [materials, chatbotSettings] = await Promise.all([
    getCourseMaterialsReal(data.supabase!, [course.id]),
    getCourseChatbotSettingReal(data.supabase!, course.id),
  ])

  return {
    ...data,
    course,
    materials,
    chatbotSettings,
  }
}

export async function getStudentCourseBySlug(courseSlug: string) {
  const data = await getStudentPortalData()
  const course = data.courses.find((item) => slugify(item.title) === courseSlug)

  if (!course) {
    return null
  }

  return getStudentCourseById(course.id)
}

export async function getTeacherCourseById(courseId: string) {
  const data = await getTeacherPortalData()
  const course = data.courses.find((item: { id: string }) => item.id === courseId)

  if (!course) {
    return null
  }

  if (data.isDemo) {
    const materials = mockMaterials.filter((material) => material.course_id === course.id)

    return {
      ...data,
      course,
      materials,
      chatbotSettings: {
        id: `mock-chatbot-setting-${course.id}`,
        course_id: course.id,
        tone: (course as any).chatbot_tone || "professional",
        ai_model: (course as any).ai_model || "google/gemini-3.8-flash",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as ChatbotSettings,
      studentsCount: (course as any).enrolled_students || 0,
    }
  }

  const [materials, chatbotSettings, { count }] = await Promise.all([
    getCourseMaterialsReal(data.supabase!, [course.id]),
    getCourseChatbotSettingReal(data.supabase!, course.id),
    data.supabase!
      .from("course_enrollments")
      .select("id", { count: "exact", head: true })
      .eq("course_id", course.id),
  ])

  return {
    ...data,
    course,
    materials,
    chatbotSettings,
    studentsCount: count || 0,
  }
}

export async function getTeacherAnalyticsByCourseId(courseId: string) {
  const courseData = await getTeacherCourseById(courseId)

  if (!courseData) {
    return null
  }

  if (courseData.isDemo) {
    const queries = mockQueries.filter((query) => query.course_id === courseId)
    const totalStudents = (courseData.course as any).enrolled_students || 0

    const enrollments = Array.from({ length: totalStudents }).map((_, index) => {
      const studentNumber = 6631503101 + index
      return {
        id: `demo-enrollment-${courseId}-${index + 1}`,
        course_id: courseId,
        student_id: `mock-student-${studentNumber}`,
        enrolled_at: new Date().toISOString(),
        profiles: {
          id: `mock-student-${studentNumber}`,
          full_name: `Student ${index + 1}`,
          email: `${studentNumber}@lamduan.mfu.ac.th`,
        },
      }
    })

    return {
      ...courseData,
      queries,
      enrollments,
      totalQuizzes: 0,
      totalAssignments: mockMaterials.filter(
        (material) => material.course_id === courseId && material.title.toLowerCase().includes("assignment"),
      ).length,
      totalReminders: 0,
    }
  }

  const [
    { data: queries },
    { data: enrollments },
    { count: totalQuizzes },
    { count: totalAssignments },
    { count: totalReminders },
  ] = await Promise.all([
    courseData.supabase!
      .from("student_queries")
      .select("*")
      .eq("course_id", courseId),
    courseData.supabase!
      .from("course_enrollments")
      .select("id,course_id,student_id,enrolled_at,profiles(id,full_name,email)")
      .eq("course_id", courseId),
    courseData.supabase!
      .from("quizzes")
      .select("id", { count: "exact", head: true })
      .eq("course_id", courseId),
    courseData.supabase!
      .from("course_materials")
      .select("id", { count: "exact", head: true })
      .eq("course_id", courseId)
      .ilike("title", "%assignment%"),
    courseData.supabase!
      .from("study_reminders")
      .select("id", { count: "exact", head: true })
      .eq("course_id", courseId),
  ])

  return {
    ...courseData,
    queries: queries || [],
    enrollments: enrollments || [],
    totalQuizzes: totalQuizzes || 0,
    totalAssignments: totalAssignments || 0,
    totalReminders: totalReminders || 0,
  }
}

export async function getStudentRemindersData() {
  const context = await getSessionContext()

  if (context.isDemo) {
    return {
      ...context,
      courses: mockCourses,
      reminders: [],
    }
  }

  if (!context.supabase || !context.userId) {
    return {
      ...context,
      courses: [],
      reminders: [],
    }
  }

  const courses = await getStudentCoursesReal(context.supabase!, context.userId)

  const { data: reminders } = await context.supabase!
    .from("study_reminders")
    .select("id, student_id, course_id, reminder_text, reminder_time, is_completed, created_at, courses(title, code)")
    .eq("student_id", context.userId)
    .order("reminder_time", { ascending: true })

  return {
    ...context,
    courses,
    reminders: reminders || [],
  }
}
