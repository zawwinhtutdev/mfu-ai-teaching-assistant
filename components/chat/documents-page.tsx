"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useChat } from "@ai-sdk/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Download, FileText, Loader2, MessageSquare, RefreshCw, Send, Trash2, Upload, X } from "lucide-react"
import { Message, MessageContent } from "@/components/ai-elements/message"
import { Response } from "@/components/ai-elements/response"
import { Thinking } from "@/components/ai-elements/thinking"
import {
  DOCUMENT_UPLOAD_ACCEPT,
  DOCUMENT_UPLOAD_FORMATS_LABEL,
  MAX_DOCUMENT_UPLOAD_BYTES,
  isSupportedDocument,
} from "@/lib/documents/supported-formats"

interface UserDocument {
  id: string
  file_name: string
  mime_type: string | null
  size_bytes: number
  gemini_index_status?: "pending" | "ready" | "failed" | "skipped"
  gemini_index_error?: string | null
  gemini_indexed_at?: string | null
  created_at: string
  url: string
}

interface TeacherCourse {
  id: string
  title: string
  code: string
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export function DocumentsPage() {
  const [documents, setDocuments] = useState<UserDocument[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [reindexingId, setReindexingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [activeDocId, setActiveDocId] = useState<string | null>(null)
  const [chatInput, setChatInput] = useState("")
  const [teacherCourses, setTeacherCourses] = useState<TeacherCourse[]>([])
  const [canBulkUploadToCourse, setCanBulkUploadToCourse] = useState(false)
  const [selectedCourseId, setSelectedCourseId] = useState("")
  const [isBulkUploading, setIsBulkUploading] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const bulkFileInputRef = useRef<HTMLInputElement | null>(null)

  const activeDocument = useMemo(
    () => documents.find((doc) => doc.id === activeDocId) || null,
    [documents, activeDocId],
  )

  const chatKey = `doc-rag-${activeDocument?.id || "none"}`
  const docChatBody = useMemo(
    () =>
      activeDocument
        ? {
            pdfRagEnabled: true,
            ragDocumentId: activeDocument.id,
            ragDocumentName: activeDocument.file_name,
            transientChat: true,
          }
        : {
            pdfRagEnabled: false,
            transientChat: true,
          },
    [activeDocument],
  )

  const { messages: docMessages, sendMessage: sendDocMessage, status: docChatStatus, setMessages: setDocMessages } = useChat({
    id: chatKey,
    api: "/api/chat",
    body: docChatBody,
  } as any)

  useEffect(() => {
    setDocMessages([])
    setChatInput("")
  }, [activeDocument?.id, setDocMessages])

  const loadDocuments = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/documents")
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || "Failed to load documents")
      }
      setDocuments(data.documents || [])
    } catch (err: any) {
      setError(err?.message || "Failed to load documents")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadDocuments()
  }, [])

  useEffect(() => {
    const loadTeacherCourses = async () => {
      try {
        const response = await fetch("/api/teacher/courses")
        if (!response.ok) {
          setCanBulkUploadToCourse(false)
          return
        }
        const data = await response.json()
        const courses: TeacherCourse[] = Array.isArray(data?.courses) ? data.courses : []
        setTeacherCourses(courses)
        setCanBulkUploadToCourse(true)
        if (courses.length > 0) {
          setSelectedCourseId(courses[0].id)
        }
      } catch {
        setCanBulkUploadToCourse(false)
      }
    }
    void loadTeacherCourses()
  }, [])

  const pollingRef = useRef<number | null>(null)

  useEffect(() => {
    const hasPending = documents.some((doc) => doc.gemini_index_status === "pending")
    if (hasPending && !pollingRef.current) {
      pollingRef.current = window.setInterval(() => {
        void loadDocuments()
      }, 8000)
    } else if (!hasPending && pollingRef.current) {
      window.clearInterval(pollingRef.current)
      pollingRef.current = null
    }
    return () => {
      if (pollingRef.current) {
        window.clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [documents])

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    const selectedFiles = Array.from(files)
    const unsupportedFile = selectedFiles.find((file) => !isSupportedDocument(file.name, file.type))
    if (unsupportedFile) {
      setError(`${unsupportedFile.name} is not supported. Accepted formats: ${DOCUMENT_UPLOAD_FORMATS_LABEL}.`)
      return
    }
    if (selectedFiles.reduce((total, file) => total + file.size, 0) > MAX_DOCUMENT_UPLOAD_BYTES) {
      setError("The selected files exceed the 4 MB upload limit.")
      return
    }

    setIsUploading(true)
    setError(null)
    setNotice(null)
    try {
      const form = new FormData()
      selectedFiles.forEach((file) => form.append("files", file))

      const response = await fetch("/api/documents", {
        method: "POST",
        body: form,
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || "Upload failed")
      }

      setDocuments((prev) => [...(data.documents || []), ...prev])
      if (fileInputRef.current) fileInputRef.current.value = ""
    } catch (err: any) {
      setError(err?.message || "Upload failed")
    } finally {
      setIsUploading(false)
    }
  }

  const handleDelete = async (id: string) => {
    setError(null)
    setNotice(null)
    try {
      const response = await fetch(`/api/documents/${id}`, { method: "DELETE" })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || "Delete failed")
      }
      setDocuments((prev) => prev.filter((doc) => doc.id !== id))
      if (activeDocId === id) {
        setActiveDocId(null)
      }
    } catch (err: any) {
      setError(err?.message || "Delete failed")
    }
  }

  const handleReindex = async (id: string) => {
    setReindexingId(id)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch(`/api/documents/${id}/reindex`, { method: "POST" })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || "Reindex failed")
      }
      if (data?.document) {
        setDocuments((prev) => prev.map((doc) => (doc.id === id ? data.document : doc)))
      } else {
        await loadDocuments()
      }
    } catch (err: any) {
      setError(err?.message || "Reindex failed")
    } finally {
      setReindexingId(null)
    }
  }

  const handleChatWithDocument = (doc: UserDocument) => {
    setNotice(null)
    setActiveDocId(doc.id)
    setChatInput("")
  }

  const handleBulkCourseUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    if (!selectedCourseId) {
      setError("Select a course first for bulk upload.")
      return
    }

    setIsBulkUploading(true)
    setError(null)
    setNotice(null)
    try {
      const form = new FormData()
      form.append("courseId", selectedCourseId)
      Array.from(files).forEach((file) => form.append("files", file))

      const response = await fetch("/api/documents/course-bulk", {
        method: "POST",
        body: form,
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || "Bulk upload failed")
      }

      const uploaded = Array.isArray(data?.documents) ? data.documents : []
      setDocuments((prev) => [...uploaded, ...prev])
      setNotice(`Bulk uploaded ${uploaded.length} file${uploaded.length === 1 ? "" : "s"} to course RAG.`)
      if (bulkFileInputRef.current) bulkFileInputRef.current.value = ""
    } catch (err: any) {
      setError(err?.message || "Bulk upload failed")
    } finally {
      setIsBulkUploading(false)
    }
  }

  const handleDocChatSubmit = async () => {
    if (!activeDocument || !chatInput.trim() || docChatStatus === "streaming") return
    if (activeDocument.gemini_index_status !== "ready") {
      setError("Selected document is not ready for RAG yet. Wait for indexing or use Reindex.")
      return
    }
    const text = chatInput.trim()
    setChatInput("")
    await sendDocMessage(
      {
        parts: [{ type: "text", text }],
      },
      {
        body: {
          pdfRagEnabled: true,
          ragDocumentId: activeDocument.id,
          ragDocumentName: activeDocument.file_name,
          transientChat: true,
        },
      },
    )
  }

  const filteredDocuments = documents.filter((doc) => {
    const q = search.toLowerCase()
    return (
      doc.file_name.toLowerCase().includes(q) ||
      (doc.mime_type || "").toLowerCase().includes(q)
    )
  })

  return (
    <div className="h-full overflow-auto bg-linear-to-br from-blue-50/50 via-white to-indigo-50/50 p-4 sm:p-6">
      <div className={`mx-auto gap-4 ${activeDocument ? "max-w-7xl lg:grid lg:grid-cols-[minmax(0,1fr)_420px]" : "max-w-5xl"}`}>
        <Card>
          <CardHeader className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 text-[#A81D24]" />
                Documents RAG
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => void loadDocuments()} disabled={isLoading}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  Upload
                </Button>
                <Input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={DOCUMENT_UPLOAD_ACCEPT}
                  onChange={(event) => handleUpload(event.currentTarget.files)}
                  className="hidden"
                />
              </div>
            </div>
            {canBulkUploadToCourse && (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                  <SelectTrigger className="sm:max-w-sm">
                    <SelectValue placeholder={teacherCourses.length > 0 ? "Select course" : "No courses available"} />
                  </SelectTrigger>
                  <SelectContent>
                    {teacherCourses.map((course) => (
                      <SelectItem key={course.id} value={course.id}>
                        [{course.code}] {course.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={() => bulkFileInputRef.current?.click()}
                  disabled={isBulkUploading || teacherCourses.length === 0 || !selectedCourseId}
                >
                  {isBulkUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  Bulk Upload to Course RAG
                </Button>
                <Input
                  ref={bulkFileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,application/pdf,.txt,.md,.csv,.json,.xml,text/plain,text/markdown,text/csv,application/json,application/xml"
                  onChange={(event) => handleBulkCourseUpload(event.currentTarget.files)}
                  className="hidden"
                />
              </div>
            )}
            <Input
              placeholder="Search documents..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </CardHeader>
          <CardContent className="space-y-3">
            {error && (
              <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
            {notice && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {notice}
              </div>
            )}

            {isLoading ? (
              <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading documents...
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No documents yet. Upload {DOCUMENT_UPLOAD_FORMATS_LABEL} files to use them in chat RAG.
              </div>
            ) : (
              <div className="space-y-2">
                {filteredDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{doc.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(doc.size_bytes)} • {doc.mime_type || "Unknown type"} • {new Date(doc.created_at).toLocaleString()}
                      </p>
                      {doc.gemini_index_status && (
                        <div className="space-y-0.5">
                          <p className="text-xs text-muted-foreground">
                            RAG index: {doc.gemini_index_status}
                            {doc.gemini_index_error ? ` (${doc.gemini_index_error})` : ""}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleChatWithDocument(doc)}
                      >
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Chat
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <a href={doc.url} target="_blank" rel="noreferrer">
                          <Download className="mr-2 h-4 w-4" />
                          Open
                        </a>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReindex(doc.id)}
                        disabled={reindexingId === doc.id || isUploading}
                      >
                        {reindexingId === doc.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="mr-2 h-4 w-4" />
                        )}
                        Reindex
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(doc.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {activeDocument && (
          <Card className="mt-4 flex flex-col lg:mt-0 lg:h-[calc(100vh-8rem)] lg:max-h-[820px] overflow-hidden">
            <CardHeader className="shrink-0 space-y-2 pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="text-base">Document Chat</CardTitle>
                  <p className="truncate text-xs text-muted-foreground">{activeDocument.file_name}</p>
                  <p className="text-xs text-blue-700">
                    Document RAG mode is on. This panel uses the selected document only.
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setActiveDocId(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {activeDocument.gemini_index_status !== "ready" && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                  This document is not ready for RAG yet (status: {activeDocument.gemini_index_status || "pending"}).
                </div>
              )}
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col gap-3 pt-0 pb-4 overflow-hidden">
              <div className="min-h-0 flex-1 overflow-y-auto rounded-md border p-3">
                {docMessages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Ask a question about this document (summary, key points, definitions, quiz prep).
                  </p>
                ) : (
                  <div className="space-y-3">
                    {docMessages.map((message: any) => {
                      const from = message.role === "assistant" ? "assistant" : "user"
                      return (
                        <Message key={message.id} from={from}>
                          <MessageContent from={from}>
                            {(Array.isArray(message.parts) ? message.parts : [])
                              .filter((part: any) => part?.type === "text")
                              .map((part: any, idx: number) => (
                                <Response key={`${message.id}-${idx}`} enableMarkdown={from === "assistant"}>
                                  {part.text}
                                </Response>
                              ))}
                          </MessageContent>
                        </Message>
                      )
                    })}
                    {docChatStatus === "streaming" && <Thinking />}
                  </div>
                )}
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <Input
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault()
                      handleDocChatSubmit()
                    }
                  }}
                  placeholder={`Ask about ${activeDocument.file_name}...`}
                  disabled={docChatStatus === "streaming"}
                />
                <Button
                  onClick={handleDocChatSubmit}
                  disabled={docChatStatus === "streaming" || !chatInput.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
