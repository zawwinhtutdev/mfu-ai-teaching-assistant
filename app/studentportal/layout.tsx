import { StudentPortalLayout } from "@/components/student/student-portal-layout"
import { PortalProvider } from "@/lib/portal-context"
import { getStudentPortalData } from "@/lib/server/session-data"

export default async function StudentPortalLayoutWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  const data = await getStudentPortalData()

  return (
    <PortalProvider initialProfile={data.profile} initialCourses={data.courses}>
      <StudentPortalLayout profile={data.profile} courses={data.courses}>
        {children}
      </StudentPortalLayout>
    </PortalProvider>
  )
}
