import { KnowledgeConsole } from "@/components/knowledge/knowledge-console"

export const dynamic = "force-dynamic"

export default function AdminKnowledgePage() {
  // The admin layout already restricts this route to the admin role.
  return <KnowledgeConsole canUpload />
}
