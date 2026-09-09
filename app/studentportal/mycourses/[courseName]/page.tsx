import { redirect } from "next/navigation"
import { CoursePage } from "@/components/student/course-page"
import { getStudentCourseBySlug } from "@/lib/server/session-data"
import type { Metadata } from "next"

export async function generateMetadata({ params }: { params: Promise<{ courseName: string }> }): Promise<Metadata> {
  const { courseName } = await params
  const data = await getStudentCourseBySlug(courseName)

  if (!data) {
    return { title: "Course" }
  }

  return {
    title: `${data.course.title} : ${data.course.code}`,
  }
}

export default async function StudentCoursePage({ params }: { params: Promise<{ courseName: string }> }) {
  const { courseName } = await params
  const data = await getStudentCourseBySlug(courseName)

  if (!data) {
    redirect("/studentportal/mycourses")
  }

  return (
    <CoursePage
      course={data.course}
      materials={data.materials}
      chatbotSettings={data.chatbotSettings}
      studentId={data.profile.id}
    />
  )
}
