import { ChatInterface } from "@/components/chat/chat-interface"
import { getChatData } from "@/lib/server/session-data"

function isTruthy(value: string | undefined) {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return normalized === "1" || normalized === "true" || normalized === "yes"
}

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ pdfRag?: string; docId?: string; docName?: string }>
}) {
  const params = await searchParams
  const data = await getChatData()

  return (
    <ChatInterface
      profile={data.profile}
      courses={data.courses}
      materials={data.materials}
      conversationId={null}
      pdfRagEnabled={isTruthy(params.pdfRag)}
      ragDocumentId={params.docId || null}
      ragDocumentName={params.docName || null}
    />
  )
}
