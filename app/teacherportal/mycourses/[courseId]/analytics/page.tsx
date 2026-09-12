import { redirect } from "next/navigation"
import { AnalyticsPage } from "@/components/teacher/analytics-page"
import { getTeacherAnalyticsByCourseId } from "@/lib/server/session-data"

export default async function CourseAnalyticsPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params
  const data = await getTeacherAnalyticsByCourseId(courseId)

  if (!data) {
    redirect("/teacherportal/mycourses")
  }

  return (
    <AnalyticsPage
      course={data.course}
      queries={data.queries}
      enrollments={data.enrollments}
      totalQuizzes={data.totalQuizzes}
      totalAssignments={data.totalAssignments}
      totalReminders={data.totalReminders}
    />
  )
}
