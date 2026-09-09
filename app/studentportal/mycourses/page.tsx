import { StudentDashboard } from "@/components/student/student-dashboard"
import { enrollStudentByCourseCode, getStudentPortalData } from "@/lib/server/session-data"

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function getFirstParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? ""
  }
  return value ?? ""
}

export default async function MyCoursesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const enrollCode = getFirstParamValue(params.enroll).trim()
  const enrollmentFeedback = enrollCode ? await enrollStudentByCourseCode(enrollCode) : null

  const data = await getStudentPortalData()
  return <StudentDashboard courses={data.courses} enrollmentFeedback={enrollmentFeedback} />
}
