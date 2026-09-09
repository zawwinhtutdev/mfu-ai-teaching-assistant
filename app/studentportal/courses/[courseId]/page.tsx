import { redirect } from "next/navigation"
import { CoursePage } from "@/components/student/course-page"
import { getStudentCourseById } from "@/lib/server/session-data"

export default async function StudentCoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params
  const data = await getStudentCourseById(courseId)

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
