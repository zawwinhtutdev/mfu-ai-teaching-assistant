"use client"

/**
 * Course gradebook.
 *
 * The teacher previously graded one student at a time through a modal that had
 * to be closed and reopened for each person, with no way to see how much work
 * was outstanding across the class. This presents the whole course as a matrix,
 * which is the shape the data actually has: students down, assignments across.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  RefreshCw,
  Save,
  Upload,
  Users,
} from "lucide-react"

type GradebookAssignment = {
  id: string
  title: string
  due_at: string | null
  points: number | null
  visible_to_students: boolean
}

type GradebookStudent = {
  id: string
  email: string
  full_name: string | null
}

type GradebookSubmission = {
  id: string
  assignment_id: string
  student_id: string
  submitted_at: string
  grade: number | null
  feedback: string | null
  file_name: string | null
}

/** Fixed UTC formatting, so server and browser agree and React does not warn. */
function formatShortDate(value: string | null): string {
  if (!value) return "No date"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "No date"
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${String(date.getUTCFullYear()).slice(2)}`
}

function initials(name: string | null, email: string): string {
  const source = (name || email || "?").trim()
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return source.slice(0, 2).toUpperCase()
}

interface CourseGradebookProps {
  courseId: string
  /** Bumped by the parent when an assignment is created or deleted. */
  refreshKey?: number
}

export function CourseGradebook({ courseId, refreshKey = 0 }: CourseGradebookProps) {
  const [assignments, setAssignments] = useState<GradebookAssignment[]>([])
  const [students, setStudents] = useState<GradebookStudent[]>([])
  const [submissions, setSubmissions] = useState<GradebookSubmission[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [gradeTarget, setGradeTarget] = useState<{
    assignment: GradebookAssignment
    student: GradebookStudent
    submission: GradebookSubmission
  } | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/courses/${courseId}/submissions`, { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Could not load the gradebook")
      setAssignments(Array.isArray(data?.assignments) ? data.assignments : [])
      setStudents(Array.isArray(data?.students) ? data.students : [])
      setSubmissions(Array.isArray(data?.submissions) ? data.submissions : [])
    } catch (cause: any) {
      setError(cause?.message || "Could not load the gradebook")
    } finally {
      setIsLoading(false)
    }
  }, [courseId])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  /** "assignmentId:studentId" -> submission, so a cell lookup is O(1). */
  const byCell = useMemo(() => {
    const map = new Map<string, GradebookSubmission>()
    for (const submission of submissions) {
      map.set(`${submission.assignment_id}:${submission.student_id}`, submission)
    }
    return map
  }, [submissions])

  const stats = useMemo(() => {
    const released = assignments.filter((assignment) => assignment.visible_to_students)
    const expected = released.length * students.length
    const graded = submissions.filter((submission) => submission.grade !== null)
    const ungraded = submissions.filter((submission) => submission.grade === null)

    const gradedPercents = graded.map((submission) => {
      const assignment = assignments.find((item) => item.id === submission.assignment_id)
      if (!assignment?.points) return null
      return (Number(submission.grade) / assignment.points) * 100
    }).filter((value): value is number => value !== null)

    const average =
      gradedPercents.length > 0
        ? Math.round(gradedPercents.reduce((sum, value) => sum + value, 0) / gradedPercents.length)
        : null

    return {
      expected,
      submitted: submissions.length,
      ungraded: ungraded.length,
      missing: Math.max(0, expected - submissions.length),
      average,
    }
  }, [assignments, students, submissions])

  const handleGraded = (updated: GradebookSubmission) => {
    setSubmissions((previous) =>
      previous.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)),
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading gradebook…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">Gradebook</h3>
          <p className="text-sm text-muted-foreground">
            Every student against every assignment. Click a cell to grade it.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Summary tiles: the numbers a teacher checks before reading individual rows. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon={<Users className="h-4 w-4" />}
          label="Students"
          value={String(students.length)}
          hint={`${assignments.length} assignment${assignments.length === 1 ? "" : "s"}`}
        />
        <StatTile
          icon={<Upload className="h-4 w-4" />}
          label="Submitted"
          value={`${stats.submitted}`}
          hint={`of ${stats.expected} expected`}
        />
        <StatTile
          icon={<Clock className="h-4 w-4" />}
          label="Awaiting grading"
          value={String(stats.ungraded)}
          hint={stats.ungraded === 0 ? "All caught up" : "Needs your attention"}
          tone={stats.ungraded > 0 ? "warn" : undefined}
        />
        <StatTile
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Average"
          value={stats.average === null ? "—" : `${stats.average}%`}
          hint="Across graded work"
        />
      </div>

      {students.length === 0 ? (
        <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
          No students are enrolled yet, so there is nothing to grade.
        </p>
      ) : assignments.length === 0 ? (
        <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
          Create an assignment below and its column will appear here.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-10 min-w-[190px] bg-background">
                  Student
                </TableHead>
                {assignments.map((assignment) => (
                  <TableHead key={assignment.id} className="min-w-[110px] align-bottom">
                    <span className="block truncate font-medium" title={assignment.title}>
                      {assignment.title}
                    </span>
                    <span className="block text-[11px] font-normal text-muted-foreground">
                      {assignment.points !== null ? `${assignment.points} pts · ` : ""}
                      {formatShortDate(assignment.due_at)}
                    </span>
                    {!assignment.visible_to_students && (
                      <Badge variant="secondary" className="mt-1 text-[10px]">
                        Draft
                      </Badge>
                    )}
                  </TableHead>
                ))}
                <TableHead className="min-w-[92px] text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student) => {
                let earned = 0
                let possible = 0
                let anyGraded = false
                for (const assignment of assignments) {
                  const submission = byCell.get(`${assignment.id}:${student.id}`)
                  if (submission && submission.grade !== null && assignment.points) {
                    earned += Number(submission.grade)
                    possible += assignment.points
                    anyGraded = true
                  }
                }

                return (
                  <TableRow key={student.id}>
                    <TableCell className="sticky left-0 z-10 bg-background">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold">
                          {initials(student.full_name, student.email)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">
                            {student.full_name || student.email}
                          </span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {student.email}
                          </span>
                        </span>
                      </div>
                    </TableCell>

                    {assignments.map((assignment) => {
                      const submission = byCell.get(`${assignment.id}:${student.id}`)
                      return (
                        <TableCell key={assignment.id} className="p-1">
                          <GradeCell
                            assignment={assignment}
                            submission={submission}
                            onClick={() =>
                              submission &&
                              setGradeTarget({ assignment, student, submission })
                            }
                          />
                        </TableCell>
                      )
                    })}

                    <TableCell className="text-right text-sm font-medium">
                      {anyGraded ? (
                        <span>
                          {earned}
                          <span className="text-muted-foreground">/{possible}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <GradeDialog
        courseId={courseId}
        target={gradeTarget}
        onClose={() => setGradeTarget(null)}
        onGraded={handleGraded}
      />
    </div>
  )
}

function StatTile({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint: string
  tone?: "warn"
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </p>
      <p
        className={`mt-1 text-2xl font-semibold ${tone === "warn" ? "text-amber-600" : ""}`}
      >
        {value}
      </p>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
  )
}

function GradeCell({
  assignment,
  submission,
  onClick,
}: {
  assignment: GradebookAssignment
  submission?: GradebookSubmission
  onClick: () => void
}) {
  if (!submission) {
    return (
      <span className="flex h-9 items-center justify-center rounded-md text-xs text-muted-foreground">
        —
      </span>
    )
  }

  const graded = submission.grade !== null
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-9 w-full items-center justify-center gap-1 rounded-md border px-1 text-xs transition-colors hover:bg-muted ${
        graded
          ? "border-emerald-600/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
          : "border-amber-500/40 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
      }`}
      title={
        graded
          ? `Graded ${submission.grade}${assignment.points ? ` / ${assignment.points}` : ""}`
          : "Submitted, not graded yet"
      }
    >
      {graded ? (
        <>
          <CheckCircle2 className="h-3 w-3" />
          {submission.grade}
          {assignment.points ? <span className="opacity-60">/{assignment.points}</span> : null}
        </>
      ) : (
        <>
          <Clock className="h-3 w-3" />
          Grade
        </>
      )}
    </button>
  )
}

function GradeDialog({
  courseId,
  target,
  onClose,
  onGraded,
}: {
  courseId: string
  target: {
    assignment: GradebookAssignment
    student: GradebookStudent
    submission: GradebookSubmission
  } | null
  onClose: () => void
  onGraded: (submission: GradebookSubmission) => void
}) {
  const [grade, setGrade] = useState("")
  const [feedback, setFeedback] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submission = target?.submission

  useEffect(() => {
    setGrade(submission?.grade === null || submission?.grade === undefined ? "" : String(submission.grade))
    setFeedback(submission?.feedback ?? "")
    setError(null)
  }, [submission?.id, submission?.grade, submission?.feedback])

  const save = async () => {
    if (!target) return
    setIsSaving(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/courses/${courseId}/assignments/${target.assignment.id}/submissions`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            submissionId: target.submission.id,
            grade: grade === "" ? null : Number(grade),
            feedback,
          }),
        },
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Could not save the grade")
      onGraded({
        ...target.submission,
        grade: data?.submission?.grade ?? null,
        feedback: data?.submission?.feedback ?? null,
      })
      onClose()
    } catch (cause: any) {
      setError(cause?.message || "Could not save the grade")
    } finally {
      setIsSaving(false)
    }
  }

  const overMax =
    target?.assignment.points !== null &&
    target?.assignment.points !== undefined &&
    grade !== "" &&
    Number(grade) > target.assignment.points

  return (
    <Dialog open={Boolean(target)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="truncate">{target?.assignment.title}</DialogTitle>
          <DialogDescription>
            {target?.student.full_name || target?.student.email} ·{" "}
            submitted {submission ? formatShortDate(submission.submitted_at) : "—"}
            {target?.assignment.points !== null && target?.assignment.points !== undefined
              ? ` · out of ${target.assignment.points} pts`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {submission?.file_name && (
            <p className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{submission.file_name}</span>
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="gradebook-grade">Grade</Label>
            <Input
              id="gradebook-grade"
              value={grade}
              onChange={(event) => setGrade(event.target.value)}
              inputMode="decimal"
              placeholder="Not graded"
            />
            {overMax && (
              <p className="text-xs text-amber-600">
                Higher than the {target?.assignment.points ?? 0} points available.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gradebook-feedback">Feedback</Label>
            <Textarea
              id="gradebook-feedback"
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
              rows={3}
              placeholder="Optional note to the student"
            />
          </div>

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save grade
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
