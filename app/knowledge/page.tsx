import { KnowledgeConsole } from "@/components/knowledge/knowledge-console"

export const dynamic = "force-dynamic"

export default function KnowledgePage() {
  // Read-only view: teachers upload from the teacher portal.
  return <KnowledgeConsole canUpload={false} />
}
