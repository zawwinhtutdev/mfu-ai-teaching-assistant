import { SettingsPage as StudentSettingsPage } from "@/components/student/settings-page"
import { getStudentPortalData } from "@/lib/server/session-data"

export default async function SettingsPage() {
  const data = await getStudentPortalData()
  return <StudentSettingsPage profile={data.profile} />
}
