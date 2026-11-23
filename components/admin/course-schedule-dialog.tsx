"use client"

/**
 * Weekly schedule for one course (administrator).
 *
 * A course needs at least one section with a timetable before it can appear on
 * the calendar. This dialog is where that gets entered: each row is one weekly
 * class meeting, and the text is parsed into a weekday so the calendar can place
 * it on the right dates.
 *
 * The timetable field is free text because that is how the university writes it
 * in its own system ("WED 12:00 pm - 02:50 pm"). The parser understands a
 * weekday plus a time range; anything it cannot read is flagged here rather than
 * silently dropped, so a typo does not look like a missing class.
 */

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from "react"
import { SectionStudentsBlock, type EnrollmentCatalog } from "@/components/admin/section-students-block"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertTriangle, Loader2, Plus, Trash2 } from "lucide-react"
import { formatScheduleTime, parseTimetable } from "@/lib/course-schedule"

type Row = {
  id?: string
  section_no: string
  section_type: string
  timetable: string
  room: string
  capacity: string
  requested: string
}

interface CourseScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  courseId: string | null
  courseLabel: string
  onSaved?: () => void
}

function blankRow(index: number): Row {
  return {
    section_no: String(index + 1).padStart(2, "0"),
    section_type: "Lecture",
    timetable: "",
    room: "",
    capacity: "30",
    requested: "0",
  }
}

export type CourseSchedulePanelHandle = {
  save: () => Promise<void>
}

export const CourseSchedulePanel = forwardRef<
  CourseSchedulePanelHandle,
  {
    courseId: string
    onSaved?: () => void
    showSaveButton?: boolean
    onEnrollmentChanged?: () => void
  }
>(function CourseSchedulePanel(
  { courseId, onSaved, showSaveButton = true, onEnrollmentChanged },
  ref,
) {
  const [rows, setRows] = useState<Row[]>([blankRow(0)])
  const [catalog, setCatalog] = useState<EnrollmentCatalog | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadEnrollment = useCallback(async () => {
    if (!courseId) return
    try {
      const res = await fetch(`/api/admin/course-enrollment?courseId=${courseId}`, { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Could not load students")
      setCatalog({
        enrolled: Array.isArray(data?.enrolled) ? data.enrolled : [],
        available: Array.isArray(data?.available) ? data.available : [],
      })
    } catch {
      setCatalog({ enrolled: [], available: [] })
    }
  }, [courseId])

  const load = useCallback(async () => {
    if (!courseId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/courses?courseId=${courseId}`, { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Could not load the schedule")
      const sections = Array.isArray(data?.sections) ? data.sections : []
      setRows(
        sections.length === 0
          ? [blankRow(0)]
          : sections.map((s: any) => ({
              id: typeof s.id === "string" ? s.id : undefined,
              section_no: s.section_no ?? "",
              section_type: s.section_type ?? "Lecture",
              timetable: s.timetable ?? "",
              room: s.room ?? "",
              capacity: String(s.capacity ?? 30),
              requested: String(s.requested ?? 0),
            })),
      )
    } catch (cause: any) {
      setError(cause?.message || "Could not load the schedule")
    } finally {
      setLoading(false)
    }
  }, [courseId])

  const refreshStudents = useCallback(() => {
    void loadEnrollment()
    onEnrollmentChanged?.()
  }, [loadEnrollment, onEnrollmentChanged])

  const sectionNoById = useMemo(() => {
    const map = new Map<string, string>()
    for (const row of rows) {
      if (row.id) map.set(row.id, row.section_no)
    }
    return map
  }, [rows])

  useEffect(() => {
    void load()
    void loadEnrollment()
  }, [load, loadEnrollment])

  const update = (index: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))

  const sectionPayloadFromRow = useCallback((row: Row) => {
    if (!row.section_no.trim()) return null
    return {
      ...(row.id ? { id: row.id } : {}),
      section_no: row.section_no.trim(),
      section_type: row.section_type,
      timetable: row.timetable.trim() || null,
      room: row.room.trim() || null,
      capacity: row.capacity,
      requested: row.requested,
    }
  }, [])

  const buildSectionPayload = useCallback(
    () =>
      rows
        .map((row) => sectionPayloadFromRow(row))
        .filter((row): row is NonNullable<typeof row> => row !== null),
    [rows, sectionPayloadFromRow],
  )

  const patchSections = useCallback(
    async (payload: ReturnType<typeof buildSectionPayload>) => {
      if (!courseId) return
      if (payload.length === 0) {
        throw new Error("Add a section number before assigning students.")
      }

      const res = await fetch("/api/admin/courses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, sections: payload }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Could not save the schedule")

      await load()
    },
    [courseId, load],
  )

  const persistSections = useCallback(async () => {
    await patchSections(buildSectionPayload())
  }, [buildSectionPayload, patchSections])

  const fetchSectionIdFromServer = useCallback(
    async (sectionNo: string) => {
      const res = await fetch(`/api/admin/courses?courseId=${encodeURIComponent(courseId)}`, {
        cache: "no-store",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Could not load sections")

      const normalised = sectionNo.trim()
      const match = (Array.isArray(data?.sections) ? data.sections : []).find(
        (section: { section_no?: string; id?: string }) => section.section_no?.trim() === normalised,
      )
      return (match?.id as string | undefined) ?? null
    },
    [courseId],
  )

  const resolveSectionId = useCallback(
    async (sectionNo: string) => {
      const normalised = sectionNo.trim()
      const existing = rows.find((row) => row.section_no.trim() === normalised)?.id
      if (existing) return existing

      const fromServer = await fetchSectionIdFromServer(normalised)
      if (fromServer) {
        await load()
        return fromServer
      }

      const row = rows.find((r) => r.section_no.trim() === normalised)
      const single = row ? sectionPayloadFromRow(row) : null
      if (single) {
        await patchSections([single])
      } else {
        await persistSections()
      }

      const afterSave = await fetchSectionIdFromServer(normalised)
      if (!afterSave) {
        throw new Error("Could not find that section after save.")
      }
      return afterSave
    },
    [fetchSectionIdFromServer, load, patchSections, persistSections, rows, sectionPayloadFromRow],
  )

  const assignStudentsToSection = useCallback(
    async (studentIds: string[], sectionNo: string) => {
      if (studentIds.length === 0) return
      const sectionId = await resolveSectionId(sectionNo)
      const res = await fetch("/api/admin/course-enrollment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, studentIds, sectionId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Could not assign those students")
      await loadEnrollment()
      await load()
      onEnrollmentChanged?.()
    },
    [courseId, load, loadEnrollment, onEnrollmentChanged, resolveSectionId],
  )

  const assignStudentToSection = useCallback(
    async (studentId: string, sectionNo: string) => {
      await assignStudentsToSection([studentId], sectionNo)
    },
    [assignStudentsToSection],
  )

  const save = useCallback(async () => {
    if (!courseId) return
    setSaving(true)
    setError(null)
    try {
      await persistSections()
      await loadEnrollment()
      onSaved?.()
    } catch (cause: unknown) {
      const message = cause instanceof Error ? cause.message : "Could not save the schedule"
      setError(message)
      throw cause instanceof Error ? cause : new Error(message)
    } finally {
      setSaving(false)
    }
  }, [courseId, loadEnrollment, onSaved, persistSections])

  useImperativeHandle(ref, () => ({ save }), [save])

  return (
    <>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {rows.map((row, index) => {
              const parsed = parseTimetable(row.timetable)
              return (
                <div key={index} className="space-y-2 rounded-lg border p-3">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <div className="min-w-0">
                      <Label className="text-[11px]">Section</Label>
                      <Input
                        value={row.section_no}
                        onChange={(e) => update(index, { section_no: e.target.value })}
                        placeholder="01"
                        className="mt-1 h-9 w-full"
                      />
                    </div>
                    <div className="min-w-0">
                      <Label className="text-[11px]">Type</Label>
                      <Select
                        value={row.section_type}
                        onValueChange={(value) => update(index, { section_type: value })}
                      >
                        <SelectTrigger className="mt-1 h-9 w-full max-w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Lecture">Lecture</SelectItem>
                          <SelectItem value="Lab">Lab</SelectItem>
                          <SelectItem value="Tutorial">Tutorial</SelectItem>
                          <SelectItem value="Online">Online</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="min-w-0 col-span-2 sm:col-span-1">
                      <Label className="text-[11px]">Room</Label>
                      <Input
                        value={row.room}
                        onChange={(e) => update(index, { room: e.target.value })}
                        placeholder="C5 319"
                        className="mt-1 h-9 w-full"
                      />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <Label className="text-[11px]">Class timetable</Label>
                    <Input
                      value={row.timetable}
                      onChange={(e) => update(index, { timetable: e.target.value })}
                      placeholder="WED 12:00 pm - 02:50 pm"
                      className="mt-1 h-9 w-full"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[11px]">Capacity</Label>
                      <Input
                        value={row.capacity}
                        onChange={(e) => update(index, { capacity: e.target.value })}
                        inputMode="numeric"
                        className="mt-1 h-9"
                      />
                    </div>
                    <div className="flex items-end justify-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={rows.length === 1}
                        onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        Remove
                      </Button>
                    </div>
                  </div>

                  {/* Parse feedback: a timetable the calendar cannot read would
                      otherwise look like a missing class with no explanation. */}
                  {row.timetable.trim() ? (
                    parsed ? (
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                        Every week on{" "}
                        {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][parsed.weekday]}{" "}
                        · {formatScheduleTime(parsed)}
                      </p>
                    ) : (
                      <p className="flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="h-3 w-3" />
                        Add a weekday (e.g. WED) so the calendar can place this class.
                      </p>
                    )
                  ) : null}

                  {catalog && row.section_no.trim() ? (
                    <SectionStudentsBlock
                      courseId={courseId}
                      sectionId={row.id}
                      sectionNo={row.section_no.trim()}
                      capacity={Number.parseInt(row.capacity, 10) || 0}
                      catalog={catalog}
                      sectionNoById={sectionNoById}
                      onChanged={refreshStudents}
                      onAssignBySectionNo={assignStudentToSection}
                      onBulkAssignToSection={assignStudentsToSection}
                    />
                  ) : null}
                </div>
              )
            })}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRows((prev) => [...prev, blankRow(prev.length)])}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add another section
            </Button>

            {error && (
              <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            {showSaveButton ? (
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  onClick={() => {
                    void save().catch(() => undefined)
                  }}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save schedule
                </Button>
              </div>
            ) : null}
          </div>
        )}
    </>
  )
})

export function CourseScheduleDialog({
  open,
  onOpenChange,
  courseId,
  courseLabel,
  onSaved,
}: CourseScheduleDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Weekly schedule — {courseLabel}</DialogTitle>
          <DialogDescription>
            One row per weekly class. The calendar places these on the matching weekday, every week.
          </DialogDescription>
        </DialogHeader>
        {courseId ? (
          <CourseSchedulePanel
            courseId={courseId}
            onSaved={() => {
              onOpenChange(false)
              onSaved?.()
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
