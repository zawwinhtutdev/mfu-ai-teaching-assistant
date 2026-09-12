import { redirect } from "next/navigation"

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function getFirstParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? ""
  }
  return value ?? ""
}

export default async function StudentCoursesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const enrollCode = getFirstParamValue(params.enroll)

  if (enrollCode) {
    redirect(`/studentportal/mycourses?enroll=${encodeURIComponent(enrollCode)}`)
  }

  redirect("/studentportal/mycourses")
}
