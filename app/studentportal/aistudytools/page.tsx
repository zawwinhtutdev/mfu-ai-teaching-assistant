import { getStudentPortalData } from "@/lib/server/session-data"
import { AiStudyToolsHub } from "@/components/student/ai-study-tools-hub"

export default async function AiStudyToolsPage() {
  const data = await getStudentPortalData()
  return <AiStudyToolsHub courses={data.courses} />
}
