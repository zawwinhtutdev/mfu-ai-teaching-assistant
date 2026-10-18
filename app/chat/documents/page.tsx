import { KnowledgeConsole } from "@/components/knowledge/knowledge-console"

export const dynamic = "force-dynamic"

export default function ChatDocumentsPage() {
  return <KnowledgeConsole canUpload={false} />
}
