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
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertTriangle, Loader2, Plus, Trash2 } from "lucide-react"
import { formatScheduleTime, parseTimetable } from "@/lib/course-schedule"

type Row = {
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

export function CourseScheduleDialog({
  open,
  onOpenChange,
  courseId,
  courseLabel,
  onSaved,
}: CourseScheduleDialogProps) {
  const [rows, setRows] = useState<Row[]>([blankRow(0)])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  const update = (index: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))

  const save = async () => {
    if (!courseId) return
    setSaving(true)
    setError(null)
    try {
      // Empty rows are dropped rather than saved: a section with no timetable
      // would never appear on the calendar, so it would just be noise.
      const payload = rows
        .filter((row) => row.section_no.trim() && row.timetable.trim())
        .map((row) => ({
          section_no: row.section_no.trim(),
          section_type: row.section_type,
          timetable: row.timetable.trim(),
          room: row.room.trim() || null,
          capacity: row.capacity,
          requested: row.requested,
        }))

      const res = await fetch("/api/admin/courses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, sections: payload }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Could not save the schedule")

      onOpenChange(false)
      onSaved?.()
    } catch (cause: any) {
      setError(cause?.message || "Could not save the schedule")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Weekly schedule — {courseLabel}</DialogTitle>
          <DialogDescription>
            One row per weekly class. The calendar places these on the matching weekday, every week.
          </DialogDescription>
        </DialogHeader>

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
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    <div>
                      <Label className="text-[11px]">Section</Label>
                      <Input
                        value={row.section_no}
                        onChange={(e) => update(index, { section_no: e.target.value })}
                        placeholder="01"
                        className="mt-1 h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px]">Type</Label>
                      <Select
                        value={row.section_type}
                        onValueChange={(value) => update(index, { section_type: value })}
                      >
                        <SelectTrigger className="mt-1 h-9">
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
                    <div className="col-span-2 sm:col-span-2">
                      <Label className="text-[11px]">Class timetable</Label>
                      <Input
                        value={row.timetable}
                        onChange={(e) => update(index, { timetable: e.target.value })}
                        placeholder="WED 12:00 pm - 02:50 pm"
                        className="mt-1 h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px]">Room</Label>
                      <Input
                        value={row.room}
                        onChange={(e) => update(index, { room: e.target.value })}
                        placeholder="C5 319"
                        className="mt-1 h-9"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div>
                      <Label className="text-[11px]">Capacity</Label>
                      <Input
                        value={row.capacity}
                        onChange={(e) => update(index, { capacity: e.target.value })}
                        inputMode="numeric"
                        className="mt-1 h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px]">Requested</Label>
                      <Input
                        value={row.requested}
                        onChange={(e) => update(index, { requested: e.target.value })}
                        inputMode="numeric"
                        className="mt-1 h-9"
                      />
                    </div>
                    <div className="col-span-2 flex items-end justify-end">
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

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void save()} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save schedule
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
