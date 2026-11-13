"use client"

/**
 * Review and grade submissions for one assignment.
 *
 * Shows every enrolled student who submitted, with their answer or file, and a
 * grade field. Grading goes through PATCH, which only touches grade and feedback
 * — a teacher cannot edit the student's answer from here.
 */

import { useCallback, useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { FileText, Loader2, Save } from "lucide-react"

type StudentSubmission = {
  id: string
  student_id: string
  student_name: string | null
  student_email: string | null
  content: string | null
  file_url: string | null
  file_name: string | null
  submitted_at: string
  grade: number | null
  feedback: string | null
}

interface SubmissionsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  courseId: string
  assignmentId: string | null
  assignmentTitle: string
  maxPoints: number | null
}

export function SubmissionsDialog({
  open,
  onOpenChange,
  courseId,
  assignmentId,
  assignmentTitle,
  maxPoints,
}: SubmissionsDialogProps) {
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Edits are held locally so typing does not fire a request per keystroke.
  const [drafts, setDrafts] = useState<Record<string, { grade: string; feedback: string }>>({})

  const load = useCallback(async () => {
    if (!assignmentId) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/courses/${courseId}/assignments/${assignmentId}/submissions`,
        { cache: "no-store" },
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Could not load submissions")
      const rows: StudentSubmission[] = Array.isArray(data?.submissions) ? data.submissions : []
      setSubmissions(rows)
      setDrafts(
        Object.fromEntries(
          rows.map((row) => [
            row.id,
            { grade: row.grade === null ? "" : String(row.grade), feedback: row.feedback ?? "" },
          ]),
        ),
      )
    } catch (cause: any) {
      setError(cause?.message || "Could not load submissions")
    } finally {
      setIsLoading(false)
    }
  }, [courseId, assignmentId])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  const save = async (submission: StudentSubmission) => {
    const draft = drafts[submission.id]
    if (!draft) return
    setBusyId(submission.id)
    setError(null)
    try {
      const res = await fetch(
        `/api/courses/${courseId}/assignments/${assignmentId}/submissions`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            submissionId: submission.id,
            grade: draft.grade === "" ? null : Number(draft.grade),
            feedback: draft.feedback,
          }),
        },
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Could not save the grade")
      setSubmissions((prev) =>
        prev.map((row) =>
          row.id === submission.id
            ? { ...row, grade: data?.submission?.grade ?? null, feedback: data?.submission?.feedback ?? null }
            : row,
        ),
      )
    } catch (cause: any) {
      setError(cause?.message || "Could not save the grade")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Submissions — {assignmentTitle}</DialogTitle>
          <DialogDescription>
            {isLoading
              ? "Loading…"
              : `${submissions.length} submission${submissions.length === 1 ? "" : "s"}${
                  maxPoints !== null ? ` · out of ${maxPoints} pts` : ""
                }`}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : submissions.length === 0 ? (
          <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
            No students have submitted yet.
          </p>
        ) : (
          <div className="space-y-3">
            {submissions.map((submission) => {
              const draft = drafts[submission.id] ?? { grade: "", feedback: "" }
              return (
                <div key={submission.id} className="space-y-2 rounded-lg border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 font-medium">
                        {submission.student_name || "Unnamed student"}
                        {submission.grade !== null && (
                          <Badge variant="outline">{submission.grade} pts</Badge>
                        )}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {submission.student_email}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      Submitted {new Date(submission.submitted_at).toLocaleString()}
                    </span>
                  </div>

                  {submission.content && (
                    <p className="whitespace-pre-wrap rounded bg-muted/50 p-2 text-sm">
                      {submission.content}
                    </p>
                  )}

                  {submission.file_url && (
                    <a
                      href={submission.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs underline"
                    >
                      <FileText className="h-3 w-3" />
                      {submission.file_name || "Attached file"}
                    </a>
                  )}

                  <div className="flex flex-wrap items-end gap-2">
                    <div>
                      <label
                        htmlFor={`grade-${submission.id}`}
                        className="text-[11px] text-muted-foreground"
                      >
                        Grade
                      </label>
                      <Input
                        id={`grade-${submission.id}`}
                        value={draft.grade}
                        onChange={(event) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [submission.id]: { ...draft, grade: event.target.value },
                          }))
                        }
                        inputMode="decimal"
                        className="h-8 w-20"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <label
                        htmlFor={`feedback-${submission.id}`}
                        className="text-[11px] text-muted-foreground"
                      >
                        Feedback
                      </label>
                      <Input
                        id={`feedback-${submission.id}`}
                        value={draft.feedback}
                        onChange={(event) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [submission.id]: { ...draft, feedback: event.target.value },
                          }))
                        }
                        placeholder="Optional"
                        className="h-8"
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === submission.id}
                      onClick={() => void save(submission)}
                    >
                      {busyId === submission.id ? (
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="mr-1 h-3.5 w-3.5" />
                      )}
                      Save
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
