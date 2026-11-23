import { redirect } from "next/navigation"
import { TeacherCoursePage } from "@/components/teacher/teacher-course-page"
import { getTeacherCourseById } from "@/lib/server/session-data"

export default async function TeacherCourseManagePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params
  const data = await getTeacherCourseById(courseId)

  if (!data) {
    redirect("/teacherportal/mycourses")
  }

  return (
    <TeacherCoursePage
      course={data.course}
      materials={data.materials}
      studentsCount={data.studentsCount}
      enrolledStudents={data.enrolledStudents}
      pendingInvitations={data.pendingInvitations}
      chatbotSettings={data.chatbotSettings}
    />
  )
}
