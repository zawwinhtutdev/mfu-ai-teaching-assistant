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
import { CalendarClock, CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react"

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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Assignments</h3>
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
          <div className="space-y-3">
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
                </Card>
              )
            })}
          </div>

          {past.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Past deadlines
              </p>
              {past.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="truncate">{assignment.title}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDue(assignment.due_at)}
                  </span>
                </div>
              ))}
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
    </div>
  )
}
