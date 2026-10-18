import { KnowledgeConsole } from "@/components/knowledge/knowledge-console"

export const dynamic = "force-dynamic"

export default function StudentPortalDocumentsPage() {
  // Students can read and ask, but cannot upload course material.
  return <KnowledgeConsole canUpload={false} />
}
