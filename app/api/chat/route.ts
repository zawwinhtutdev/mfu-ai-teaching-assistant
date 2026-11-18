import { convertToModelMessages, createUIMessageStreamResponse, streamText, toUIMessageStream } from "ai"
import { createGoogle } from "@ai-sdk/google"
import { createOpenAI } from "@ai-sdk/openai"
import { cookies } from "next/headers"
import { getUserFacingChatError } from "@/lib/ai/chat-errors"
import {
  geminiModelCandidates,
  getModelConfig,
  hostedProvider,
  openaiModelName,
  googleThinkingOff,
  isRetryableModelError,
  normalizeGoogleProviderModel,
} from "@/lib/ai/models"
import { createClient } from "@/lib/supabase/server"
import { getDocumentReadUrl } from "@/lib/storage/spaces"
import { trackApiError } from "@/lib/server/observability"
import {
  extractStoreNameFromDocumentName,
  getGeminiFileSearchContext,
  getUserGeminiFileSearchStoreName,
} from "@/lib/ai/gemini-file-search"
import { retrieveCourseRagContext } from "@/lib/ai/course-rag"
import { extractPdfTextFromBuffer } from "@/lib/ai/pdf-parse-node"
import { createLocalChatResponse, shouldUseLocalChatService } from "@/lib/ai/local-chat"
import { DEMO_EMAIL_COOKIE, DEMO_ROLE_COOKIE, getDemoAccountByRole } from "@/lib/demo-auth"
import { getLatestReadyDemoStoreName, readDemoDocumentsCookie, type DemoDocumentRecord, DEMO_DOCUMENTS_COOKIE } from "@/lib/demo-documents"
import { isPdfDocument } from "@/lib/documents/supported-formats"
import { hasAiProcessingConsent } from "@/lib/server/consent"
import { logStudentQuery } from "@/lib/server/query-logging"
import { assertCourseAccess, clientForPrincipal, resolvePrincipal } from "@/lib/server/principal"
import { RATE_LIMITS, checkRateLimit, rateLimitResponse, userRateLimitKey } from "@/lib/server/rate-limit"

// A local 7B model on a laptop can exceed 30s on a long grounded answer, and
// the previous limit cut streams off mid-sentence.
export const maxDuration = 120

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const PDF_TEXT_FALLBACK_CHAR_LIMIT = 20000

function extractTextFromMessage(message: any): string {
  if (!message || typeof message !== "object") return ""

  if (Array.isArray(message.parts)) {
    const fromParts = message.parts
      .filter((p: any) => p?.type === "text" && typeof p?.text === "string")
      .map((p: any) => p.text)
      .join("\n")
      .trim()
    if (fromParts) return fromParts
  }

  if (typeof message.content === "string") {
    return message.content.trim()
  }

  if (Array.isArray(message.content)) {
    return message.content
      .map((part: any) => {
        if (typeof part === "string") return part
        if (part?.type === "text" && typeof part?.text === "string") return part.text
        return ""
      })
      .join("\n")
      .trim()
  }

  return ""
}

function isTruthy(value: unknown) {
  if (typeof value === "boolean") return value
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    return normalized === "1" || normalized === "true" || normalized === "yes"
  }
  return false
}

/**
 * Wrap an async generator in the `AsyncIterableStream` shape the AI SDK expects.
 *
 * Needed only to replay a chunk consumed while probing a model for availability.
 * The SDK's type requires the ReadableStream half as well as the async-iterable
 * half, so the underlying stream is built once and both interfaces are exposed
 * over it — reading through either must not duplicate or drop chunks.
 */
function toAsyncIterableStream<T>(source: AsyncIterable<T>) {
  const iterator = source[Symbol.asyncIterator]()
  const stream = new ReadableStream<T>({
    async pull(controller) {
      const { done, value } = await iterator.next()
      if (done) controller.close()
      else controller.enqueue(value)
    },
    async cancel() {
      await iterator.return?.()
    },
  })

  return Object.assign(stream, {
    [Symbol.asyncIterator]: () => iterator,
  })
}

async function loadPdfTextFallbackByObjectKey(objectKey: string) {
  const readUrl = await getDocumentReadUrl(objectKey, 300)
  const response = await fetch(readUrl)
  if (!response.ok) {
    throw new Error(`Failed to download PDF from storage (${response.status})`)
  }
  const buffer = Buffer.from(await response.arrayBuffer())
  return (await extractPdfTextFromBuffer(buffer)).trim()
}

export async function POST(req: Request) {
  try {
    console.log("🚀🚀🚀 CHAT API CALLED - NEW MESSAGE SENT! 🚀🚀🚀")
    console.log("[v0] Chat API called")

    const {
      messages,
      conversationId,
      studentId,
      model = "default",
      systemPromptOverride,
      attachments = [],
      pdfRagEnabled = false,
      ragDocumentId = null,
      ragDocumentName = null,
      transientChat = false,
      courseId = null,
      tone = null,
      materials = [],
      trigger = "submit-message",
    } = await req.json()

    console.log("[v0] Request data:", { conversationId, studentId, messageCount: messages.length })
    console.log("[v0] MODEL SELECTED:", model)
    console.log("[v0] SYSTEM PROMPT OVERRIDE RECEIVED:", systemPromptOverride ? `YES (${systemPromptOverride.length} chars)` : "NO")

    const cookieStore = await cookies()
    const demoRole = cookieStore.get(DEMO_ROLE_COOKIE)?.value
    const demoEmail = cookieStore.get(DEMO_EMAIL_COOKIE)?.value
    const demoAccount = getDemoAccountByRole(demoRole)
    const isDemoSession = !!(
      demoAccount &&
      demoEmail &&
      demoEmail.toLowerCase() === demoAccount.email.toLowerCase()
    )
    const demoDocuments: DemoDocumentRecord[] =
      isDemoSession && demoAccount
        ? readDemoDocumentsCookie(cookieStore.get(DEMO_DOCUMENTS_COOKIE)?.value, demoAccount.email)
        : []

    // One identity for both demo cookies and real Supabase sessions. Course
    // access is checked by `assertCourseAccess`, which knows the demo seed's
    // enrollment data as well as the RLS-backed tables.
    const principal = await resolvePrincipal()
    const supabase = (await clientForPrincipal(
      principal ?? { privilegedClient: null } as any,
    )) as Awaited<ReturnType<typeof createClient>>

    const userId = principal?.userId || studentId || ""
    const userRole = principal?.role || "student"

    // Anonymous callers are refused before any provider call is made. The
    // route used to answer them, which was harmless against a local model but
    // became billable abuse the moment a paid API key was configured: a probe
    // with no session got a 200 and a real completion. The rate limiter keys on
    // a user id, so an anonymous caller would also have shared one bucket.
    if (!principal) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[v0] Using userId:", userId, "role:", userRole, "demo:", principal?.isDemo)

    // Charged before retrieval and generation so a refused request costs
    // nothing upstream. Regenerating an answer is a real provider call, so it
    // counts too rather than being a way to bypass the limit.
    const limit = checkRateLimit(userRateLimitKey("chat", userId || "anonymous"), RATE_LIMITS.chat)
    if (!limit.ok) {
      return rateLimitResponse(limit)
    }

    // Create or get conversation
    let currentConversationId = conversationId

    const hasUserDocumentAccess = UUID_REGEX.test(userId)
    const canPersist = hasUserDocumentAccess && !isTruthy(transientChat)
    if (!currentConversationId && canPersist) {
      console.log("[v0] Creating new conversation")
      // Create new conversation with title from first user message
      const firstUserMessage = messages.find((m: any) => m.role === "user")
      const title =
        firstUserMessage?.parts?.find((p: any) => p.type === "text")?.text?.substring(0, 50) || "New Conversation"

      const { data: newConversation, error } = await supabase
        .from("conversations")
        .insert({
          user_id: userId,
          title,
        })
        .select()
        .single()

      if (error) {
        console.error("[v0] Error creating conversation:", error)
        return Response.json({ error: "Failed to create conversation", details: error.message }, { status: 500 })
      }

      if (!newConversation) {
        console.error("[v0] No conversation returned")
        return Response.json({ error: "Failed to create conversation" }, { status: 500 })
      }

      currentConversationId = newConversation.id
      console.log("[v0] Created conversation:", currentConversationId)
    } else if (!canPersist) {
      console.log("[v0] Running in non-persistent chat mode")
    }

    const lastUserMessage = messages.filter((m: any) => m.role === "user").pop()
    const userMessageText = extractTextFromMessage(lastUserMessage)
    const requestedCourseId = typeof courseId === "string" ? courseId.trim() : ""
    const requestedTone = typeof tone === "string" ? tone.trim().toLowerCase() : ""

    // Save user message to database
    if (lastUserMessage && currentConversationId && canPersist && trigger !== "regenerate-message") {
      console.log("[v0] Saving user message:", userMessageText.substring(0, 50))
      const { error: messageError } = await supabase.from("messages").insert({
        conversation_id: currentConversationId,
        role: "user",
        content: userMessageText,
      })

      if (messageError) {
        console.error("[v0] Error saving user message:", messageError)
      }
    }

    // Base role prompt (default path)
    const rolePrompt =
      userRole === "student"
        ? `You are an AI teaching assistant for MFU (Mae Fah Luang University). Your role is to:
- Answer questions about courses and study materials
- Provide explanations and clarifications
- Offer study guidance and tips
- Help students understand complex concepts
- Be encouraging and supportive
- Maintain a friendly and approachable tone

Always be helpful, clear, and encouraging in your responses.`
        : `You are an AI teaching assistant for MFU (Mae Fah Luang University). Your role is to:
- Help teachers with course planning and material organization
- Provide insights on student engagement and learning patterns
- Suggest teaching strategies and best practices
- Assist with content creation and assessment design
- Maintain a professional and collaborative tone

Always be helpful, insightful, and professional in your responses.`

    // Dedicated prompt for MFU Guide (for everyone) - fallback if client doesn't send override
    const mfuGuidePrompt = `You are MFU Guide for everyone (students, staff, applicants, visitors, alumni). Always identify yourself as "MFU Guide", not as an AI teaching assistant.
If the user asks "who are you" or similar, clearly answer: "I'm MFU Guide for Mae Fah Luang University. I help with any MFU-related questions."
Answer any question related to Mae Fah Luang University (MFU): campus locations, services, facilities, offices, dining, transport, dorms, libraries, sports, events, calendars, fees, scholarships, admissions, academics, research, IT, policies, forms, contacts, and student/staff life.
Guidelines:
- Be clear, concise, and practical. Prefer step-by-step instructions when relevant.
- If multiple options exist (locations, hours, contacts), list as bullet points.
- Include official names and common nicknames when helpful.
- When unsure, say so and suggest how to verify (official site, office, phone/email).
- Lead with the actionable answer; add detail only if asked.`

    let courseSettingsNote = ""
    let courseRetrievalNote = ""
    let coursePromptOverride: string | null = null
    let analyticsCourseId: string | null = null
    // The UUID of the course the caller is actually authorized for. Retrieval
    // must use this rather than the requested value, which may be a code.
    let authorizedCourseId: string | null = null

    const shouldUsePdfRag = isTruthy(pdfRagEnabled)

    if (!shouldUsePdfRag && requestedCourseId) {
      // Authorization is one call, and it understands both Supabase UUIDs and
      // course codes so demo sessions and real sessions behave identically.
      const authorizedCourse = principal
        ? await assertCourseAccess(principal, requestedCourseId)
        : null

      // A requested course the caller may not read is refused outright. It must
      // never fall through to retrieval: doing so would search a course the
      // caller has no right to and leak its contents through citations.
      if (!authorizedCourse) {
        return Response.json({ error: "You do not have access to this course" }, { status: 403 })
      }

      analyticsCourseId = authorizedCourse.id
      authorizedCourseId = authorizedCourse.id

      const { data: chatbotSettings } = await supabase
        .from("chatbot_settings")
        .select("tone, system_prompt, grading_policy, course_rules")
        .eq("course_id", requestedCourseId)
        .maybeSingle()

      if (chatbotSettings?.system_prompt) {
        coursePromptOverride = chatbotSettings.system_prompt
      }

      const effectiveTone = (chatbotSettings?.tone || requestedTone || "").toLowerCase()
      const toneInstruction =
        effectiveTone === "friendly"
          ? "Use a warm and encouraging tone."
          : effectiveTone === "casual"
            ? "Use a casual and approachable tone while staying accurate."
            : effectiveTone === "formal"
              ? "Use a formal, academic tone."
              : "Use a professional and clear teaching tone."

      courseSettingsNote = [
        "Course-specific assistant settings are active.",
        toneInstruction,
        chatbotSettings?.grading_policy
          ? `Course grading policy:\n${chatbotSettings.grading_policy}`
          : "",
        chatbotSettings?.course_rules
          ? `Course-specific rules:\n${chatbotSettings.course_rules}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n")

      if (userMessageText.trim()) {
        try {
          const retrieval = await retrieveCourseRagContext({
            supabase: supabase as any,
            courseId: authorizedCourse.id,
            query: userMessageText,
            topK: 6,
          })

          if (retrieval.context) {
            const sourceTitles = Array.from(
              new Set(
                retrieval.chunks
                  .map((chunk) => chunk.material_title || "Material")
                  .filter(Boolean),
              ),
            )
            courseRetrievalNote = [
              "Use the following retrieved course-material context for grounding.",
              sourceTitles.length ? `Material sources: ${sourceTitles.join(", ")}` : "",
              retrieval.context,
              "If the answer is not present in this context, explicitly say it is not found in uploaded course materials.",
              "Cite the most relevant material title in your response.",
            ]
              .filter(Boolean)
              .join("\n\n")
          } else {
            courseRetrievalNote = [
              "No relevant course-material chunks were retrieved for this question.",
              "Answer only if you are confident from existing context; otherwise clearly say this is not found in uploaded course materials.",
            ].join("\n")
          }
        } catch (courseRetrievalError: any) {
          console.error("[v0] Course RAG retrieval failed:", courseRetrievalError)
          courseRetrievalNote = [
            "Course retrieval encountered an internal error for this request.",
            "If the answer depends on course uploads, say that retrieval is temporarily unavailable and ask to retry.",
          ].join("\n")
        }
      }

      // Client-supplied context for sessions that carry materials but no course
      // id. Course-scoped requests were already authorized above.
      if (!authorizedCourseId && Array.isArray(materials) && materials.length > 0) {
        // Client-supplied context for demo/non-persistent sessions.
        const materialContext = materials
          .slice(0, 5)
          .map((material: any) =>
            `Material: ${material?.title || "Untitled"}\n${String(material?.content || "").slice(0, 2800)}`,
          )
          .join("\n\n")
        courseRetrievalNote = [
          "Course context was provided by the app for this demo/non-persistent session.",
          materialContext,
          "Answer based on this provided course context only.",
        ]
          .filter(Boolean)
          .join("\n\n")
      }
    }

    // Choose final system prompt via centralized model config; client override wins
    const requestedModel = typeof model === "string" ? model : "default"
    const cfg = getModelConfig(requestedModel)
    let systemPrompt: string
    // Priority: systemPromptOverride > coursePromptOverride > cfg.systemPrompt > rolePrompt/mfuGuidePrompt
    if (systemPromptOverride) {
      systemPrompt = systemPromptOverride
      console.log("[v0] Using CLIENT OVERRIDE system prompt")
    } else if (coursePromptOverride) {
      systemPrompt = coursePromptOverride
      console.log("[v0] Using COURSE SETTINGS system prompt")
    } else if (cfg.systemPrompt) {
      systemPrompt = cfg.systemPrompt
      console.log("[v0] Using CONFIG system prompt")
    } else if (cfg.id === "mfumodelbeta" || cfg.id === "mfumodelbeta2") {
      systemPrompt = mfuGuidePrompt
      console.log("[v0] Using MFU Guide fallback prompt")
    } else {
      systemPrompt = rolePrompt
      console.log("[v0] Using role-based fallback prompt")
    }
    console.log("[v0] Final system prompt length:", systemPrompt.length, "chars")
    console.log("[v0] Final system prompt preview:", systemPrompt.substring(0, 150) + "...")

    const attArray = Array.isArray(attachments) ? attachments : []
    const imageParts = attArray
      .filter((a: any) => typeof a === 'object' ? (a.type?.startsWith('image/') && a.url && /^https?:\/\//.test(a.url)) : false)
      .map((a: any) => ({ type: "image", image: a.url }))

    const attachmentNote = attArray.length
      ? `The user attached files. Analyze images if provided and reference document links when helpful.`
      : ""

    const requestedDocId = typeof ragDocumentId === "string" ? ragDocumentId.trim() : ""
    const requestedDocName = typeof ragDocumentName === "string" ? ragDocumentName.trim() : ""
    const selectedDemoDoc = requestedDocId ? demoDocuments.find((doc) => doc.id === requestedDocId) : null
    const shouldPreferDemoDocumentsForRag = !!(
      isDemoSession &&
      (requestedDocId.startsWith("demo-doc-") || selectedDemoDoc)
    )
    let pdfRagModeInstruction = shouldUsePdfRag
      ? [
          "The user is in document RAG mode with an uploaded document already selected by the app.",
          "Never say you cannot access the selected document in this mode.",
          "If retrieval returns no passages, explain that no relevant indexed passage was found and ask a narrower question.",
        ].join("\n")
      : ""
    let fileSearchNote = ""
    if (shouldUsePdfRag && userMessageText.trim()) {
      let indexedDocNames: string[] = []
      let fileSearchStore: string | null = null
      let selectedDocObjectKey: string | null = null
      let selectedDocIndexStatus: "pending" | "ready" | "failed" | "skipped" | null = null
      let selectedDocIsPdf = false

      if (shouldPreferDemoDocumentsForRag) {
        const scopedDemoDocs =
          requestedDocId
            ? demoDocuments.filter((doc) => doc.id === requestedDocId)
            : demoDocuments
        const selectedDoc = scopedDemoDocs[0] || selectedDemoDoc || null
        selectedDocObjectKey = selectedDoc?.object_key || null
        selectedDocIndexStatus = selectedDoc?.gemini_index_status || null
        selectedDocIsPdf = selectedDoc ? isPdfDocument(selectedDoc.file_name, selectedDoc.mime_type) : false

        indexedDocNames = scopedDemoDocs
          .filter((doc) => doc.gemini_index_status === "ready")
          .map((doc) => doc.file_name)
          .filter(Boolean)
        fileSearchStore =
          getLatestReadyDemoStoreName(scopedDemoDocs) ||
          scopedDemoDocs
            .map((doc) => extractStoreNameFromDocumentName(doc.gemini_document_name))
            .find((value): value is string => !!value) ||
          null
        if (!fileSearchStore) {
          fileSearchStore =
            getLatestReadyDemoStoreName(demoDocuments) ||
            demoDocuments
              .map((doc) => extractStoreNameFromDocumentName(doc.gemini_document_name))
              .find((value): value is string => !!value) ||
            null
        }
      } else if (hasUserDocumentAccess) {
        let selectedUserDoc: any = null
        if (requestedDocId) {
          const { data: docById } = await supabase
            .from("user_documents")
            .select("id, file_name, mime_type, object_key, gemini_store_name, gemini_document_name, gemini_index_status")
            .eq("user_id", userId)
            .eq("id", requestedDocId)
            .maybeSingle()
          selectedUserDoc = docById || null
        }

        if (selectedUserDoc) {
          selectedDocObjectKey = selectedUserDoc.object_key || null
          selectedDocIndexStatus = selectedUserDoc.gemini_index_status || null
          selectedDocIsPdf = isPdfDocument(selectedUserDoc.file_name, selectedUserDoc.mime_type)
          if (selectedUserDoc.gemini_index_status === "ready" && selectedUserDoc.file_name) {
            indexedDocNames = [selectedUserDoc.file_name]
          }
          fileSearchStore =
            selectedUserDoc.gemini_store_name ||
            extractStoreNameFromDocumentName(selectedUserDoc.gemini_document_name) ||
            null
          console.log("[v0] Selected doc for document RAG:", {
            id: selectedUserDoc.id,
            status: selectedUserDoc.gemini_index_status,
            hasStore: !!fileSearchStore,
            hasObjectKey: !!selectedDocObjectKey,
          })
        }

        if (!requestedDocId || !selectedUserDoc) {
          const { data: readyDocs } = await supabase
            .from("user_documents")
            .select("id, file_name, mime_type, object_key, gemini_store_name, gemini_document_name")
            .eq("user_id", userId)
            .eq("gemini_index_status", "ready")
            .order("created_at", { ascending: false })
            .limit(8)

          if (!selectedDocObjectKey) {
            selectedDocObjectKey = (readyDocs || [])[0]?.object_key || null
            const fallbackDoc = (readyDocs || [])[0]
            selectedDocIsPdf = fallbackDoc ? isPdfDocument(fallbackDoc.file_name, fallbackDoc.mime_type) : false
            if (!selectedDocIndexStatus && (readyDocs || [])[0]) {
              selectedDocIndexStatus = "ready"
            }
          }

          indexedDocNames = (readyDocs || []).map((d: any) => d.file_name).filter(Boolean)
          fileSearchStore =
            fileSearchStore ||
            (readyDocs || []).find((d: any) => d.gemini_store_name)?.gemini_store_name ||
            (readyDocs || [])
              .map((d: any) => extractStoreNameFromDocumentName(d?.gemini_document_name))
              .find((value: string | null): value is string => !!value) ||
            null
        }

        if (!requestedDocId && !fileSearchStore) {
          fileSearchStore = await getUserGeminiFileSearchStoreName(supabase as any, userId)
        }
      } else if (isDemoSession) {
        const scopedDemoDocs =
          requestedDocId
            ? demoDocuments.filter((doc) => doc.id === requestedDocId)
            : demoDocuments
        selectedDocObjectKey = scopedDemoDocs[0]?.object_key || null
        selectedDocIndexStatus = scopedDemoDocs[0]?.gemini_index_status || null
        selectedDocIsPdf = scopedDemoDocs[0]
          ? isPdfDocument(scopedDemoDocs[0].file_name, scopedDemoDocs[0].mime_type)
          : false

        indexedDocNames = scopedDemoDocs
          .filter((doc) => doc.gemini_index_status === "ready")
          .map((doc) => doc.file_name)
          .filter(Boolean)
        fileSearchStore =
          getLatestReadyDemoStoreName(scopedDemoDocs) ||
          scopedDemoDocs
            .map((doc) => extractStoreNameFromDocumentName(doc.gemini_document_name))
            .find((value): value is string => !!value) ||
          null
      }

      if (selectedDocIndexStatus === "ready") {
        pdfRagModeInstruction = [
          pdfRagModeInstruction,
          "The selected document index status is READY.",
          "Do not say the file is still indexing/processing.",
          "If details are missing, state that the relevant passage was not found in the selected document.",
        ]
          .filter(Boolean)
          .join("\n")
      } else if (selectedDocIndexStatus === "pending") {
        pdfRagModeInstruction = [
          pdfRagModeInstruction,
          "The selected document index status is PENDING.",
          "Tell the user indexing is still in progress and ask them to retry shortly.",
        ]
          .filter(Boolean)
          .join("\n")
      } else if (selectedDocIndexStatus === "failed") {
        pdfRagModeInstruction = [
          pdfRagModeInstruction,
          "The selected document index status is FAILED.",
          "Ask the user to re-index or re-upload this file.",
        ]
          .filter(Boolean)
          .join("\n")
      }

      if (fileSearchStore) {
        const retrievalQuery = [
          requestedDocName
            ? `Target document: ${requestedDocName}`
            : "",
          userMessageText,
        ]
          .filter(Boolean)
          .join("\n")

        let retrievedContext = await getGeminiFileSearchContext({
          storeName: fileSearchStore,
          query: retrievalQuery || userMessageText,
        })

        if (!retrievedContext && requestedDocName) {
          retrievedContext = await getGeminiFileSearchContext({
            storeName: fileSearchStore,
            query: `Summarize key points from ${requestedDocName}`,
          })
        }

        if (!retrievedContext && selectedDocObjectKey && selectedDocIsPdf) {
          try {
            const fallbackText = await loadPdfTextFallbackByObjectKey(selectedDocObjectKey)
            if (fallbackText) {
              fileSearchNote = [
                requestedDocName ? `Requested PDF: ${requestedDocName}` : "Requested PDF context.",
                "Gemini File Search returned no passages. Using direct extracted PDF text fallback:",
                fallbackText.slice(0, PDF_TEXT_FALLBACK_CHAR_LIMIT),
                "Answer based on this text and explicitly mention it comes from PDF text fallback.",
              ].join("\n")
            }
          } catch (error: any) {
            console.error("[v0] PDF fallback extraction failed:", error)
          }
        }

        if (!fileSearchNote && retrievedContext) {
          fileSearchNote = [
            indexedDocNames.length
              ? `Indexed documents: ${indexedDocNames.join(", ")}`
              : (requestedDocName
                  ? `Requested document: ${requestedDocName}`
                  : "Indexed documents are available for this user."),
            "Use this context retrieved from the user's uploaded documents (Gemini File Search):",
            retrievedContext,
            "Prioritize this context for lecture/material questions.",
            "If the context is insufficient, explicitly say what information is missing from the uploaded documents.",
            "When you use this context, mention the most relevant document filename in your answer.",
          ].join("\n")
        } else if (indexedDocNames.length) {
          fileSearchNote = [
            `Indexed documents: ${indexedDocNames.join(", ")}`,
            "No relevant passages were retrieved for this exact question.",
            "If the answer is not present, clearly say you could not find it in the user's uploaded lecture files.",
            "Do not claim indexing is pending when status is ready.",
          ].join("\n")
        }
      } else {
        if (selectedDocObjectKey && selectedDocIsPdf) {
          try {
            const fallbackText = await loadPdfTextFallbackByObjectKey(selectedDocObjectKey)
            if (fallbackText) {
              fileSearchNote = [
                requestedDocName ? `Requested PDF: ${requestedDocName}` : "Requested PDF context.",
                "File-search metadata unavailable. Using direct extracted PDF text fallback:",
                fallbackText.slice(0, PDF_TEXT_FALLBACK_CHAR_LIMIT),
                "Answer based on this text and explicitly mention it comes from PDF text fallback.",
              ].join("\n")
            }
          } catch (error: any) {
            console.error("[v0] PDF fallback extraction failed (no store):", error)
          }
        }

        if (!fileSearchNote) {
          fileSearchNote = [
            requestedDocName
              ? `Requested document: ${requestedDocName}`
              : "Requested document context.",
            "No searchable metadata was available for this request.",
            "If this keeps happening for a ready document, ask the user to re-upload it or pick a different ready document.",
          ].join("\n")
        }
      }
    }

    const modelMessages = await convertToModelMessages([
      ...(imageParts.length ? [{ id: "attachments", role: "user", parts: imageParts }] as any : []),
      ...messages,
    ])

    console.log("[v0] Calling AI model with", messages.length, "messages")

    // Local models are the default path: retrieval and generation both run
    // in-process against Supabase, so there is no second database and no
    // course-id translation between them.
    if (shouldUseLocalChatService()) {
      console.log("[v0] Routing chat to the local model with in-process retrieval")
      return await createLocalChatResponse({
        messages,
        model: requestedModel,
        // Use the authorized UUID, not the requested value: a demo caller may
        // have sent a course code and retrieval needs the real id.
        courseId: authorizedCourseId || null,
        pdfRagEnabled: shouldUsePdfRag,
        toneInstruction: courseSettingsNote,
        supabase,
        onComplete: async ({ repaired, refused }) => {
          // Persisting here — not inside the Gemini branch — is what keeps
          // teacher analytics populated on the local-model path. Consent is
          // resolved inside logStudentQuery: a student who declined gets no
          // row, one who has not answered gets an anonymized row.
          if (!analyticsCourseId || userRole !== "student" || !UUID_REGEX.test(userId)) return
          if (!userMessageText) return

          if (currentConversationId && canPersist) {
            const { error: messageError } = await supabase.from("messages").insert([
              { conversation_id: currentConversationId, role: "user", content: userMessageText },
              { conversation_id: currentConversationId, role: "assistant", content: repaired },
            ])
            if (messageError) console.error("[v0] Error saving local messages:", messageError)
          }

          const outcome = await logStudentQuery({
            supabase,
            studentId: userId,
            courseId: analyticsCourseId,
            queryText: userMessageText,
            responseText: repaired,
            wasRefused: refused,
            canAttribute: UUID_REGEX.test(userId),
          })
          if (outcome === "skipped") {
            console.warn("[v0] Query analytics were not stored for this exchange")
          }
        },
      })
    }

    // Initialize the hosted provider. Ollama was handled above; this branch is
    // Gemini or OpenAI, chosen by AI_PROVIDER (or whichever key exists).
    const useOpenAI = hostedProvider() === "openai"
    const googleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
    const openaiKey = process.env.OPENAI_API_KEY?.trim()

    if (useOpenAI && !openaiKey) {
      console.error("[v0] ERROR: AI_PROVIDER=openai but OPENAI_API_KEY is not set")
      return Response.json({ error: "OpenAI API key not configured" }, { status: 500 })
    }
    if (!useOpenAI && !googleKey) {
      console.error("[v0] ERROR: GOOGLE_GENERATIVE_AI_API_KEY is not set!")
      return Response.json({ error: "Google Gemini API key not configured" }, { status: 500 })
    }

    const google = useOpenAI ? null : createGoogle({ apiKey: googleKey! })
    const openai = useOpenAI ? createOpenAI({ apiKey: openaiKey! }) : null

    // Stream AI response
    let result
    try {
      console.log(`🤖🤖🤖 CALLING AI MODEL (${useOpenAI ? "openai" : "gemini"}) 🤖🤖🤖`)
      // Route using centralized config, while supporting provider model IDs in request body.
      const providerModel = normalizeGoogleProviderModel(
        requestedModel.startsWith("google/") ? requestedModel : cfg.providerModel,
      )
      const maxOutputTokens = cfg.maxOutputTokens ?? 700
      const temperature = cfg.temperature ?? 0.6
      const instructions = [
        systemPrompt,
        courseSettingsNote,
        courseRetrievalNote,
        attachmentNote,
        pdfRagModeInstruction,
        fileSearchNote,
      ]
        .filter(Boolean)
        .join("\n\n")

      // OpenAI bills per token with no daily request cap, so a single model is
      // enough; Gemini free tier rejects whole models with 503/429, hence the
      // candidate walk there.
      const candidates = useOpenAI
        ? [openaiModelName()]
        : geminiModelCandidates(providerModel.startsWith("google/") ? providerModel : undefined)
      let lastError: unknown = null

      for (const candidate of candidates) {
        const attempt = streamText({
          model: useOpenAI ? openai!(candidate) : google!(candidate),
          messages: modelMessages,
          instructions,
          abortSignal: req.signal,
          maxOutputTokens,
          temperature,
          // Gemini-only: without it, 2.5+ spends most of maxOutputTokens on
          // hidden reasoning and the answer truncates. OpenAI rejects it.
          ...(useOpenAI ? {} : { providerOptions: googleThinkingOff() }),
        } as any)

        // `streamText` resolves before the provider responds, so the 503 only
        // appears on first read. Peek one chunk to decide whether to keep this
        // model, then replay it so the client sees the complete stream.
        const iterator = attempt.stream[Symbol.asyncIterator]()
        let first: IteratorResult<any>
        try {
          first = await iterator.next()
        } catch (attemptError) {
          if (isRetryableModelError(attemptError) && candidate !== candidates[candidates.length - 1]) {
            console.warn(`[v0] model ${candidate} unavailable, trying next`)
            lastError = attemptError
            continue
          }
          throw attemptError
        }

        result = {
          ...attempt,
          stream: toAsyncIterableStream(
            (async function* () {
              if (!first.done) yield first.value
              while (true) {
                const next = await iterator.next()
                if (next.done) return
                yield next.value
              }
            })(),
          ),
        } as unknown as typeof attempt
        console.log(`✅ AI model streaming with ${candidate}`)
        break
      }

      if (!result) {
        throw lastError ?? new Error("No Gemini model was available for this request")
      }
    } catch (streamError) {
      console.error("💥💥💥 ERROR CALLING AI MODEL:", streamError)
      throw streamError
    }

    const uiStream = toUIMessageStream({
      stream: result.stream,
      onError: (streamError: unknown) => {
        console.error("[v0] Chat stream error:", streamError)
        return getUserFacingChatError(streamError)
      },
      onFinish: async (info: any) => {
        const isAborted = info?.isAborted
        const responseParts = Array.isArray(info?.responseMessage?.parts) ? info.responseMessage.parts : []
        const assistantMessage = responseParts
          .filter((part: any) => part?.type === "text")
          .map((part: any) => part?.text || "")
          .join("")
          .trim()

        console.log("[v0] Stream finished, aborted:", isAborted, "message length:", assistantMessage.length)
        console.log("[v0] Final assistant message:", assistantMessage.substring(0, 200) + "...")

        if (!isAborted && assistantMessage && currentConversationId && canPersist) {
          console.log("[v0] Saving assistant message to database...")
          const { error: dbError } = await supabase.from("messages").insert({
            conversation_id: currentConversationId,
            role: "assistant",
            content: assistantMessage,
          })

          if (dbError) {
            console.error("[v0] Error saving assistant message:", dbError)
          } else {
            console.log("[v0] Saved assistant message to database")
          }
        } else if (!assistantMessage && !isAborted) {
          console.error("[v0] WARNING: AI generated no response!")
        } else if (isAborted) {
          console.log("[v0] Stream was aborted, not saving message")
        }

        if (
          !isAborted &&
          assistantMessage &&
          analyticsCourseId &&
          userRole === "student" &&
          UUID_REGEX.test(userId) &&
          userMessageText
        ) {
          const outcome = await logStudentQuery({
            supabase,
            studentId: userId,
            courseId: analyticsCourseId,
            queryText: userMessageText,
            responseText: assistantMessage,
            canAttribute: UUID_REGEX.test(userId),
          })
          if (outcome === "skipped") {
            console.warn("[v0] Query analytics were not stored for this exchange")
          }
        }
      },
    } as any)

    return createUIMessageStreamResponse({ stream: uiStream })
  } catch (error) {
    console.error("[v0] Chat API error:", error)
    await trackApiError({
      route: "/api/chat",
      error,
    })
    return Response.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
