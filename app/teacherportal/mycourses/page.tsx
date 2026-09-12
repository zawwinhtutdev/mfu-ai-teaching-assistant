import { TeacherDashboard } from "@/components/teacher/teacher-dashboard"
import { getTeacherPortalData } from "@/lib/server/session-data"

export default async function TeacherMyCoursesPage() {
  const data = await getTeacherPortalData()

  return (
    <TeacherDashboard
      profile={data.profile}
      courses={data.courses}
      totalQueries={data.queries.length}
    />
  )
}
