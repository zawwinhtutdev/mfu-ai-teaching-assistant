import { KnowledgeConsole } from "@/components/knowledge/knowledge-console"
import { getStudentPortalData } from "@/lib/server/session-data"

export const dynamic = "force-dynamic"

export default async function StudentPortalDocumentsPage() {
  const { courses } = await getStudentPortalData()

  return (
    <KnowledgeConsole
      canUpload={false}
      courses={courses.map((course) => ({
        id: course.id,
        code: course.code,
        title: course.title,
      }))}
    />
  )
}
