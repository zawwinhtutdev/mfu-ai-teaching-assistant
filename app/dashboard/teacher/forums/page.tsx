import { redirect } from "next/navigation"

// Redirect to analytics page since "forums" is actually analytics dashboard
export default function TeacherForumsPage() {
  redirect("/teacherportal/analytics")
}

