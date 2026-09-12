import { TeacherPortalLayout } from "@/components/teacher/teacher-portal-layout"
import { getTeacherPortalData } from "@/lib/server/session-data"

export default async function TeacherDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const data = await getTeacherPortalData()

  return (
    <TeacherPortalLayout profile={data.profile} courses={data.courses}>
      {children}
    </TeacherPortalLayout>
  )
}
