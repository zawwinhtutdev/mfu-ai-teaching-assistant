import { redirect } from "next/navigation"
import { SettingsPage } from "@/components/teacher/settings-page"
import { getTeacherPortalData } from "@/lib/server/session-data"

export default async function TeacherSettingsPage() {
  const data = await getTeacherPortalData()

  if (!data.userId) {
    redirect("/login")
  }

  return <SettingsPage profile={data.profile} />
}

