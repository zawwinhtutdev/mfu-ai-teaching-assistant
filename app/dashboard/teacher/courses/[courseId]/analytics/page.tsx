import { redirect } from "next/navigation"

export default async function TeacherCourseAnalyticsPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params
  redirect(`/teacherportal/mycourses/${courseId}/analytics`)
}
