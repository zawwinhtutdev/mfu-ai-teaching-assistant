import { KnowledgeConsole } from "@/components/knowledge/knowledge-console"
import { getTeacherPortalData } from "@/lib/server/session-data"

export const dynamic = "force-dynamic"

export default async function TeacherPortalDocumentsPage() {
  const { courses } = await getTeacherPortalData()

  return (
    <KnowledgeConsole
      canUpload
      courses={courses.map((course) => ({
        id: course.id,
        code: course.code,
        title: course.title,
      }))}
    />
  )
}
