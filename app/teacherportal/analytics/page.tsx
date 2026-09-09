import { AnalyticsDashboard } from "@/components/teacher/analytics-dashboard"
import { getTeacherPortalData } from "@/lib/server/session-data"

export default async function TeacherAnalyticsPage() {
  const data = await getTeacherPortalData()

  return <AnalyticsDashboard profile={data.profile} courses={data.courses} queries={data.queries} />
}
