import { getStudentPortalData } from "@/lib/server/session-data"
import { StudentAnalyticsDashboard } from "@/components/student/student-analytics-dashboard"

export default async function StudentAnalyticsPage() {
  const data = await getStudentPortalData()
  return <StudentAnalyticsDashboard profile={data.profile} courses={data.courses} />
}
