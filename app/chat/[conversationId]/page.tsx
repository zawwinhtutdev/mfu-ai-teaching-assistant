import { ChatInterface } from "@/components/chat/chat-interface"
import { getChatData } from "@/lib/server/session-data"

function isTruthy(value: string | undefined) {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return normalized === "1" || normalized === "true" || normalized === "yes"
}

export default async function ConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ conversationId: string }>
  searchParams: Promise<{ pdfRag?: string; docId?: string; docName?: string }>
}) {
  const { conversationId } = await params
  const query = await searchParams
  const data = await getChatData()

  return (
    <ChatInterface
      profile={data.profile}
      courses={data.courses}
      materials={data.materials}
      conversationId={conversationId}
      pdfRagEnabled={isTruthy(query.pdfRag)}
      ragDocumentId={query.docId || null}
      ragDocumentName={query.docName || null}
    />
  )
}
