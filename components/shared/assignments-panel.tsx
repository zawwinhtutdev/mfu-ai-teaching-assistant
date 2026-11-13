"use client"

import { useCallback, useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CalendarClock, CheckCircle2, Loader2, Plus, Trash2, Upload, Users } from "lucide-react"
import { SubmitAssignmentDialog, type Submission } from "./submit-assignment-dialog"
import { SubmissionsDialog } from "./submissions-dialog"
import { CourseGradebook } from "./course-gradebook"

export type Assignment = {
  id: string
  course_id: string
  title: string
  instructions: string | null
  due_at: string | null
  points: number | null
  visible_to_students: boolean
  created_at: string
}

function formatDue(dueAt: string | null) {
  if (!dueAt) return "No due date"
  return new Date(dueAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

/** Relative urgency, which is what a student actually acts on. */
function dueState(dueAt: string | null): { label: string; className: string } {
  if (!dueAt) return { label: "No deadline", className: "text-muted-foreground" }
  const ms = new Date(dueAt).getTime() - Date.now()
  if (ms < 0) return { label: "Overdue", className: "text-destructive" }
  const hours = ms / 36e5
  if (hours < 24) return { label: `Due in ${Math.max(1, Math.round(hours))}h`, className: "text-amber-600" }
  const days = Math.round(hours / 24)
  return { label: `Due in ${days}d`, className: "text-muted-foreground" }
}

interface AssignmentsPanelProps {
  courseId: string
  /** Teachers get create/edit/delete and can see drafts. */
  canManage: boolean
}

export function AssignmentsPanel({ courseId, canManage }: AssignmentsPanelProps) {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Student: which assignment are they submitting, and what have they already sent?
  const [submitTarget, setSubmitTarget] = useState<Assignment | null>(null)
  const [mySubmissions, setMySubmissions] = useState<Record<string, Submission | null>>({})
  // Teacher: whose submissions are they reviewing?
  const [reviewTarget, setReviewTarget] = useState<Assignment | null>(null)

  const [title, setTitle] = useState("")
  const [instructions, setInstructions] = useState("")
  const [dueAt, setDueAt] = useState("")
  const [points, setPoints] = useState("")

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/courses/${courseId}/assignments`, { cache: "no-store" })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || "Failed to load assignments")
      setAssignments(Array.isArray(data?.assignments) ? data.assignments : [])
    } catch (loadError: any) {
      setError(loadError?.message || "Failed to load assignments")
    } finally {
      setIsLoading(false)
    }
  }, [courseId])

  useEffect(() => {
    load()
  }, [load])

  /**
   * Load the student's own submissions once the assignments are known.
   *
   * Batched per assignment because the API is scoped to one assignment id; the
   * alternative — a course-wide submissions endpoint — would duplicate the
   * authorization logic for marginal gain on a list this size.
   */
  useEffect(() => {
    if (canManage) return
    const visible = assignments.filter((assignment) => assignment.visible_to_students)
    if (visible.length === 0) return

    let cancelled = false
    const loadMine = async () => {
      const entries = await Promise.all(
        visible.map(async (assignment) => {
          try {
            const res = await fetch(
              `/api/courses/${courseId}/assignments/${assignment.id}/submissions`,
              { cache: "no-store" },
            )
            if (!res.ok) return [assignment.id, null] as const
            const data = await res.json()
            return [assignment.id, (data?.submission ?? null) as Submission | null] as const
          } catch {
            return [assignment.id, null] as const
          }
        }),
      )
      if (!cancelled) setMySubmissions(Object.fromEntries(entries))
    }

    void loadMine()
    return () => {
      cancelled = true
    }
  }, [assignments, canManage, courseId])

  const resetForm = () => {
    setTitle("")
    setInstructions("")
    setDueAt("")
    setPoints("")
  }

  const handleCreate = async () => {
    if (!title.trim()) return
    setIsSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/courses/${courseId}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          instructions: instructions.trim(),
          // datetime-local gives a local wall-clock string; convert so the
          // stored value is an absolute instant.
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
          points: points === "" ? null : Number(points),
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || "Failed to create assignment")
      setIsDialogOpen(false)
      resetForm()
      await load()
    } catch (createError: any) {
      setError(createError?.message || "Failed to create assignment")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (assignmentId: string) => {
    const response = await fetch(`/api/courses/${courseId}/assignments/${assignmentId}`, {
      method: "DELETE",
    })
    if (response.ok) {
      setAssignments((previous) => previous.filter((item) => item.id !== assignmentId))
    }
  }

  const handleToggleVisibility = async (assignment: Assignment) => {
    const response = await fetch(`/api/courses/${courseId}/assignments/${assignment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visibleToStudents: !assignment.visible_to_students }),
    })
    if (response.ok) {
      const data = await response.json()
      setAssignments((previous) =>
        previous.map((item) => (item.id === assignment.id ? data.assignment : item)),
      )
    }
  }

  const upcoming = assignments.filter((assignment) => {
    if (!assignment.due_at) return true
    return new Date(assignment.due_at).getTime() >= Date.now()
  })
  const past = assignments.filter(
    (assignment) => assignment.due_at && new Date(assignment.due_at).getTime() < Date.now(),
  )

  return (
    <div className="space-y-6">
      {/*
        Teachers get the matrix first: students down, assignments across. The
        previous design forced a modal per student, so a teacher could not see
        who had not submitted at all.
      */}
      {canManage && <CourseGradebook courseId={courseId} refreshKey={assignments.length} />}

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">
            {canManage ? "Assignment settings" : "Assignments"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {canManage
              ? "Deadlines here generate a reminder for every enrolled student one day ahead."
              : "Deadlines generate a reminder automatically one day ahead."}
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setIsDialogOpen(true)} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            New assignment
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading assignments…
        </div>
      ) : assignments.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {canManage
              ? "No assignments yet. Add one so students get an automatic deadline reminder."
              : "No assignments have been posted for this course yet."}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className={canManage ? "grid gap-3 md:grid-cols-2" : "space-y-3"}>
            {upcoming.map((assignment) => {
              const state = dueState(assignment.due_at)
              return (
                <Card key={assignment.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <CalendarClock className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="truncate">{assignment.title}</span>
                        </CardTitle>
                        <CardDescription className="mt-1 flex flex-wrap items-center gap-2">
                          <span className={state.className}>{formatDue(assignment.due_at)}</span>
                          {assignment.points !== null && (
                            <Badge variant="outline">{assignment.points} pts</Badge>
                          )}
                          {canManage && !assignment.visible_to_students && (
                            <Badge variant="secondary">Draft — hidden from students</Badge>
                          )}
                        </CardDescription>
                      </div>
                      {canManage && (
                        <div className="flex shrink-0 gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleVisibility(assignment)}
                          >
                            {assignment.visible_to_students ? "Hide" : "Release"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(assignment.id)}
                            aria-label="Delete assignment"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  {assignment.instructions && (
                    <CardContent className="pt-0">
                      <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                        {assignment.instructions}
                      </p>
                    </CardContent>
                  )}

                  {canManage ? (
                    <CardContent className="pt-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setReviewTarget(assignment)}
                      >
                        <Users className="mr-2 h-4 w-4" />
                        View submissions
                      </Button>
                    </CardContent>
                  ) : (
                    <CardContent className="pt-0">
                      {/*
                        Without this button the student view was read-only: they
                        could see the deadline and nothing else. The state below
                        distinguishes "not started", "submitted", and "graded" so
                        one glance says whether work is still needed.
                      */}
                      {(() => {
                        const mine = mySubmissions[assignment.id]
                        return (
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              size="sm"
                              variant={mine ? "outline" : "default"}
                              onClick={() => setSubmitTarget(assignment)}
                            >
                              <Upload className="mr-2 h-4 w-4" />
                              {mine ? "Resubmit" : "Submit work"}
                            </Button>

                            {mine ? (
                              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                Submitted {new Date(mine.submitted_at).toLocaleDateString()}
                                {mine.grade !== null && (
                                  <Badge variant="outline">{mine.grade} pts</Badge>
                                )}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">Not submitted yet</span>
                            )}
                          </div>
                        )
                      })()}
                    </CardContent>
                  )}
                </Card>
              )
            })}
          </div>

          {past.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Past deadlines
              </p>
              {past.map((assignment) => {
                // An overdue assignment must stay actionable for the student who
                // has not submitted yet, otherwise a missed deadline silently
                // removes their only way to hand work in.
                const mine = mySubmissions[assignment.id]
                return (
                  <div
                    key={assignment.id}
                    className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      <span className="truncate">{assignment.title}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {formatDue(assignment.due_at)}
                      </span>
                      {!canManage &&
                        (mine ? (
                          <Badge variant="outline" className="text-xs">
                            {mine.grade !== null ? `${mine.grade} pts` : "Submitted"}
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSubmitTarget(assignment)}
                          >
                            Submit late
                          </Button>
                        ))}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New assignment</DialogTitle>
            <DialogDescription>
              Students enrolled in this course will see it and be reminded before the deadline.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="assignment-title">Title</Label>
              <Input
                id="assignment-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Business Model Canvas"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="assignment-instructions">Instructions</Label>
              <Textarea
                id="assignment-instructions"
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
                placeholder="What students need to submit, and any constraints."
                rows={4}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="assignment-due">Due</Label>
                <Input
                  id="assignment-due"
                  type="datetime-local"
                  value={dueAt}
                  onChange={(event) => setDueAt(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="assignment-points">Points</Label>
                <Input
                  id="assignment-points"
                  type="number"
                  min={0}
                  value={points}
                  onChange={(event) => setPoints(event.target.value)}
                  placeholder="optional"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isSaving || !title.trim()}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SubmitAssignmentDialog
        open={Boolean(submitTarget)}
        onOpenChange={(open) => {
          if (!open) setSubmitTarget(null)
        }}
        courseId={courseId}
        assignmentId={submitTarget?.id ?? ""}
        assignmentTitle={submitTarget?.title ?? ""}
        dueLabel={formatDue(submitTarget?.due_at ?? null)}
        onSubmitted={(submission) => {
          if (!submitTarget) return
          setMySubmissions((prev) => ({ ...prev, [submitTarget.id]: submission }))
        }}
      />

      <SubmissionsDialog
        open={Boolean(reviewTarget)}
        onOpenChange={(open) => {
          if (!open) setReviewTarget(null)
        }}
        courseId={courseId}
        assignmentId={reviewTarget?.id ?? null}
        assignmentTitle={reviewTarget?.title ?? ""}
        maxPoints={reviewTarget?.points ?? null}
      />
    </div>
  )
}
