import { redirect } from "next/navigation"
import { AgentBuilderPage } from "@/components/teacher/agent-builder-page"
import { getTeacherPortalData } from "@/lib/server/session-data"

export default async function TeacherAgentBuilderPortalPage() {
  const data = await getTeacherPortalData()

  if (!data.userId) {
    redirect("/login")
  }

  return <AgentBuilderPage profile={data.profile} courses={data.courses} />
}

