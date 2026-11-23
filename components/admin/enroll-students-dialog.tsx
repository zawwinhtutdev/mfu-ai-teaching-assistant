"use client"

/**
 * Manage one course's roster (administrator).
 *
 * Shows enrolled students and allows removing them from the course.
 */

import { useCallback, useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2, UserMinus } from "lucide-react"

type StudentRow = {
  id: string
  full_name: string | null
  email: string
  role: string
  enrolled_at?: string | null
}

interface EnrollDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  courseId: string | null
  courseLabel: string
  onChanged: () => void
}

export function EnrollStudentsPanel({
  courseId,
  onChanged,
}: {
  courseId: string
  onChanged: () => void
}) {
  const [enrolled, setEnrolled] = useState<StudentRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!courseId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/course-enrollment?courseId=${courseId}`, { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Could not load the roster")

      setEnrolled(Array.isArray(data?.enrolled) ? data.enrolled : [])
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not load the roster")
    } finally {
      setLoading(false)
    }
  }, [courseId])

  useEffect(() => {
    void load()
  }, [courseId, load])

  const removeStudent = async (studentId: string) => {
    if (!courseId) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/admin/course-enrollment?courseId=${courseId}&studentId=${studentId}`,
        { method: "DELETE" },
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Could not remove that student")
      await load()
      onChanged()
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not remove that student")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {error && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Enrolled ({enrolled.length})</h3>
          {enrolled.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">No students enrolled yet.</p>
          ) : (
            <div className="space-y-1.5">
              {enrolled.map((student) => (
                <div
                  key={student.id}
                  className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{student.full_name || "—"}</p>
                    <p className="truncate text-xs text-muted-foreground">{student.email}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {student.enrolled_at && (
                      <span className="hidden text-[10px] text-muted-foreground sm:inline">
                        since {new Date(student.enrolled_at).toLocaleDateString()}
                      </span>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={saving}
                      onClick={() => removeStudent(student.id)}
                      aria-label={`Drop ${student.full_name || student.email}`}
                      title="Drop from course"
                    >
                      <UserMinus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </>
  )
}

export function EnrollStudentsDialog({ open, onOpenChange, courseId, courseLabel, onChanged }: EnrollDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Students in {courseLabel}</DialogTitle>
          <DialogDescription>Enrolled students for this course. Remove anyone who should no longer have access.</DialogDescription>
        </DialogHeader>
        {courseId ? <EnrollStudentsPanel courseId={courseId} onChanged={onChanged} /> : null}
      </DialogContent>
    </Dialog>
  )
}