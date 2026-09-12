import { getStudentRemindersData } from "@/lib/server/session-data"
import { StudentTodoPage } from "@/components/student/student-todo-page"

export default async function TodoPage() {
  const data = await getStudentRemindersData()
  return (
    <StudentTodoPage
      reminders={data.reminders}
      courses={data.courses}
    />
  )
}
