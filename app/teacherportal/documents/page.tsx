import { KnowledgeConsole } from "@/components/knowledge/knowledge-console"

export const dynamic = "force-dynamic"

export default function TeacherPortalDocumentsPage() {
  // Teachers own course materials: this is the only place PDFs are uploaded.
  return <KnowledgeConsole canUpload />
}
