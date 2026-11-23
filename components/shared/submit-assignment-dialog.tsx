"use client"

/**
 * Submit or resubmit one assignment.
 *
 * Deliberately separate from the assignment card so the card stays readable:
 * a student reads the brief, then acts, rather than having a form permanently
 * open on every assignment.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, FileText, Loader2, Paperclip, Upload } from "lucide-react"

export type Submission = {
  id: string
  content: string | null
  file_url: string | null
  file_name: string | null
  submitted_at: string
  updated_at: string
  grade: number | null
  feedback: string | null
  graded_at: string | null
}

interface SubmitAssignmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  courseId: string
  assignmentId: string
  assignmentTitle: string
  /** Shown read-only above the form so the student knows the deadline. */
  dueLabel: string
  onSubmitted: (submission: Submission) => void
}

export function SubmitAssignmentDialog({
  open,
  onOpenChange,
  courseId,
  assignmentId,
  assignmentTitle,
  dueLabel,
  onSubmitted,
}: SubmitAssignmentDialogProps) {
  const [existing, setExisting] = useState<Submission | null>(null)
  const [content, setContent] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needsSignIn, setNeedsSignIn] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  /**
   * A 401 means the session could not be resolved at all, so retrying is
   * pointless: the raw "Unauthorized" body told a student nothing and made a
   * dead session look like a broken submit button. Say what happened and offer
   * the one action that fixes it.
   */
  const sessionExpired = useCallback(() => {
    setNeedsSignIn(true)
    return new Error("Your session has expired. Sign in again to submit this assignment.")
  }, [])

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    setNeedsSignIn(false)
    try {
      const res = await fetch(
        `/api/courses/${courseId}/assignments/${assignmentId}/submissions`,
        { cache: "no-store" },
      )
      if (res.status === 401) throw sessionExpired()
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Could not load your submission")
      const submission: Submission | null = data?.submission ?? null
      setExisting(submission)
      setContent(submission?.content ?? "")
      setFile(null)
    } catch (cause: any) {
      setError(cause?.message || "Could not load your submission")
    } finally {
      setIsLoading(false)
    }
  }, [courseId, assignmentId, sessionExpired])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  const submit = async () => {
    setIsSaving(true)
    setError(null)
    try {
      const form = new FormData()
      if (content.trim()) form.append("content", content.trim())
      if (file) form.append("file", file)

      const res = await fetch(
        `/api/courses/${courseId}/assignments/${assignmentId}/submissions`,
        { method: "POST", body: form },
      )
      if (res.status === 401) throw sessionExpired()
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Could not submit")

      onSubmitted(data.submission as Submission)
      onOpenChange(false)
    } catch (cause: any) {
      setError(cause?.message || "Could not submit")
    } finally {
      setIsSaving(false)
    }
  }

  const canSubmit = Boolean(content.trim() || file)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? "Resubmit" : "Submit"} — {assignmentTitle}</DialogTitle>
          <DialogDescription>
            Due {dueLabel}.{" "}
            {existing
              ? "Submitting again replaces your previous answer and clears any grade."
              : "Attach a file, write an answer, or both."}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {existing && (
              <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                <p className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Submitted {new Date(existing.submitted_at).toLocaleString()}
                </p>
                {existing.file_url && (
                  <a
                    href={existing.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs underline"
                  >
                    <FileText className="h-3 w-3" />
                    {existing.file_name || "Attached file"}
                  </a>
                )}
                {existing.grade !== null && (
                  <p className="mt-2 flex items-center gap-2">
                    <Badge variant="outline">{existing.grade} pts</Badge>
                    {existing.feedback && (
                      <span className="text-xs text-muted-foreground">{existing.feedback}</span>
                    )}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="submission-file">Attach a file</Label>
              <input
                ref={fileInputRef}
                id="submission-file"
                type="file"
                className="hidden"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip className="mr-2 h-4 w-4" />
                  Choose file
                </Button>
                {file ? (
                  <span className="truncate text-xs text-muted-foreground">{file.name}</span>
                ) : (
                  <span className="text-xs text-muted-foreground">Optional</span>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="submission-content">Answer</Label>
              <Textarea
                id="submission-content"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="Write your answer, or a note about the attached file."
                rows={5}
              />
            </div>

            {error && (
              <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                <p>{error}</p>
                {needsSignIn && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => router.push("/login")}
                  >
                    Sign in again
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={isSaving || !canSubmit || needsSignIn}>
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {existing ? "Resubmit" : "Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
