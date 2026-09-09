import { RemindersPage } from "@/components/student/reminders-page"
import { getStudentRemindersData } from "@/lib/server/session-data"

export default async function StudentRemindersPage() {
  const data = await getStudentRemindersData()

  return (
    <RemindersPage
      studentId={data.profile.id}
      courses={data.courses}
      reminders={data.reminders}
    />
  )
}
