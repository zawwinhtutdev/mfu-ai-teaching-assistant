import { KnowledgeConsole } from "@/components/knowledge/knowledge-console"
import { resolveRole } from "@/lib/api-service"

export const dynamic = "force-dynamic"

export default async function KnowledgePage() {
  const role = await resolveRole()
  const canUpload = role === "teacher" || role === "admin"

  return <KnowledgeConsole canUpload={canUpload} />
}
