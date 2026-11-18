"use client"

/**
 * Read-only course information.
 *
 * Opened by clicking a course name. This is where the course's full academic
 * record lives — the detail that used to be split across a "Course Info Fields"
 * settings page that described fields in the abstract rather than showing a
 * specific course's values.
 *
 * Read-only on purpose: editing stays in the Edit dialog, so opening a course to
 * look at it can never accidentally change it.
 */

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Loader2 } from "lucide-react"

type CourseInfo = {
  code: string
  title: string
  description: string | null
  semester: string | null
  academic_year: string | null
  school: string | null
  grading_type: string | null
  credit_total: number | null
  credit_lecture: number | null
  credit_lab: number | null
  credit_self_study: number | null
  further_information: string | null
}

type SectionInfo = {
  id: string
  section_no: string
  section_type: string
  timetable: string | null
  room: string | null
  capacity: number
  requested: number
  registered?: number
}

interface CourseInfoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  courseId: string | null
  /** Called after a schedule change so the list can refresh its section count. */
  onChanged?: () => void
}

/** "3 (3-0-6)" when the split is known, otherwise just the total. */
function creditLabel(course: CourseInfo): string {
  const total = course.credit_total
  if (total === null || total === undefined) return "—"
  const parts = [course.credit_lecture, course.credit_lab, course.credit_self_study]
  if (parts.every((part) => part === null || part === undefined)) return String(total)
  return `${total} (${parts.map((part) => part ?? 0).join("-")})`
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 border-b py-2 last:border-0">
      <span className="w-40 shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="min-w-0 flex-1 break-words text-sm">{value}</span>
    </div>
  )
}

export function CourseInfoDialog({ open, onOpenChange, courseId, onChanged }: CourseInfoDialogProps) {
  const [course, setCourse] = useState<CourseInfo | null>(null)
  const [sections, setSections] = useState<SectionInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !courseId) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/admin/courses?courseId=${courseId}`, { cache: "no-store" })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || "Could not load the course")
        if (cancelled) return
        setCourse(data?.course ?? null)
        setSections(Array.isArray(data?.sections) ? data.sections : [])
      } catch (cause: any) {
        if (!cancelled) setError(cause?.message || "Could not load the course")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [open, courseId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {course ? `${course.code} — ${course.title}` : "Course information"}
          </DialogTitle>
          <DialogDescription>
            {course?.school || "Course details, credits, and class sections"}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : course ? (
          <div className="space-y-6">
            <section>
              <Field label="Course code" value={course.code} />
              <Field label="Course title" value={course.title} />
              <Field label="Academic year" value={course.academic_year || "—"} />
              <Field label="Semester" value={course.semester || "—"} />
              <Field label="Credits" value={creditLabel(course)} />
              <Field label="School" value={course.school || "—"} />
              <Field label="Grading" value={course.grading_type || "—"} />
              {course.description && (
                <Field
                  label="Description"
                  value={<span className="text-muted-foreground">{course.description}</span>}
                />
              )}
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Sections</h3>
              {sections.length === 0 ? (
                <p className="rounded-lg border border-dashed py-4 text-center text-sm text-muted-foreground">
                  No sections have been created for this course.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-emerald-50 text-left text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                        <th className="px-3 py-2">Section</th>
                        <th className="px-3 py-2">Type</th>
                        <th className="px-3 py-2">Class timetable</th>
                        <th className="px-3 py-2">Room</th>
                        <th className="px-3 py-2 text-right">Capacity</th>
                        <th className="px-3 py-2 text-right">Registered</th>
                        <th className="px-3 py-2 text-right">Remaining</th>
                        <th className="px-3 py-2 text-right">Requested</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sections.map((section) => {
                        const registered = section.registered ?? 0
                        const remaining = Math.max(section.capacity - registered, 0)
                        return (
                          <tr key={section.id} className="border-t">
                            <td className="px-3 py-2 font-medium">{section.section_no}</td>
                            <td className="px-3 py-2">{section.section_type}</td>
                            <td className="px-3 py-2">{section.timetable || "—"}</td>
                            <td className="px-3 py-2">{section.room || "—"}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{section.capacity}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{registered}</td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              <Badge
                                variant={remaining === 0 ? "destructive" : "secondary"}
                                className="text-[10px]"
                              >
                                {remaining}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">{section.requested}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {course.further_information && (
              <details className="rounded-lg border px-3 py-2" open>
                <summary className="cursor-pointer text-sm font-semibold">Further information</summary>
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                  {course.further_information}
                </p>
              </details>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
