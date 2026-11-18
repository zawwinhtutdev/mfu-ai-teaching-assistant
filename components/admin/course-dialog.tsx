"use client"

/**
 * Create or edit a course (administrator).
 *
 * Scope is deliberately narrow: identity, placement, and ownership. Grading
 * type, the credit split, and class sections were removed from this form — they
 * made creating a course a long form for values most courses never use. The
 * course record still has room for them if they are reintroduced later.
 */

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"

export type TeacherOption = { id: string; full_name: string | null; email: string }

export type CourseFormValues = {
  id?: string
  code: string
  title: string
  description: string
  semester: string
  academicYear: string
  school: string
  furtherInformation: string
  teacherId: string | null
}

interface CourseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  teachers: TeacherOption[]
  /** When present the dialog edits; otherwise it creates. */
  course?: CourseFormValues | null
  onSaved: () => void
}

const UNASSIGNED = "__unassigned__"

/** Semesters a course can run in. Stored as a string, like the rest of the form. */
const SEMESTERS = ["1", "2", "3"] as const

/**
 * MFU schools, in the order the university lists them.
 *
 * A fixed list rather than free text: the value is shown to students and used
 * for filtering, so "School of Science" and "school of science" must not become
 * two different schools.
 */
const SCHOOLS = [
  "School of Liberal Arts",
  "School of Science",
  "School of Management",
  "School of Applied Digital Technology",
  "School of Agro-Industry",
  "School of Law",
  "School of Cosmetic Science",
  "School of Health Science",
  "School of Nursing",
  "School of Anti-Aging and Regenerative Medicine",
  "School of Medicine",
  "School of Dentistry",
  "School of Social Innovation",
  "School of Sinology",
  "School of Integrative Medicine",
] as const

/**
 * Radix Select treats an empty string as "no selection" and renders the
 * SelectValue placeholder, which is what these two fields want — so no sentinel
 * is needed here. (The teacher dropdown still uses one, because its "unassigned"
 * option must be a real, selectable item rather than absence.)
 */

function emptyCourse(): CourseFormValues {
  return {
    code: "",
    title: "",
    description: "",
    semester: "",
    academicYear: "",
    school: "",
    furtherInformation: "",
    teacherId: null,
  }
}

export function CourseDialog({ open, onOpenChange, teachers, course, onSaved }: CourseDialogProps) {
  const editing = Boolean(course?.id)
  const [form, setForm] = useState<CourseFormValues>(emptyCourse())
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const set = <K extends keyof CourseFormValues>(key: K, value: CourseFormValues[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  // Reset on open so a previous edit never leaks into a create.
  useEffect(() => {
    if (!open) return
    setForm(course ? { ...course } : emptyCourse())
    setError(null)
  }, [open, course])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setError(null)

    try {
      const payload = {
        ...(editing ? { courseId: course!.id } : {}),
        code: form.code,
        title: form.title,
        description: form.description,
        semester: form.semester,
        academicYear: form.academicYear,
        school: form.school,
        furtherInformation: form.furtherInformation,
        teacherId: form.teacherId,
      }

      const res = await fetch("/api/admin/courses", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Could not save the course")

      onOpenChange(false)
      onSaved()
    } catch (cause: any) {
      setError(cause?.message || "Could not save the course")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit course" : "New course"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="course-code">Course code</Label>
              <Input
                id="course-code"
                value={form.code}
                onChange={(e) => set("code", e.target.value.toUpperCase())}
                maxLength={16}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="academic-year">Academic year</Label>
              <Input
                id="academic-year"
                value={form.academicYear}
                onChange={(e) => set("academicYear", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="semester">Semester</Label>
              {/*
                `value` is the raw form value, so an empty string means "nothing
                chosen" and Radix renders the placeholder. A sentinel such as
                "__none__" would match no item, and Radix then shows neither a
                value nor the placeholder — the trigger collapsed to a bare box.
              */}
              <Select
                value={form.semester}
                onValueChange={(value) => set("semester", value)}
              >
                <SelectTrigger id="semester" className="w-full">
                  <SelectValue placeholder="Select semester" />
                </SelectTrigger>
                <SelectContent>
                  {SEMESTERS.map((semester) => (
                    <SelectItem key={semester} value={semester}>
                      Semester {semester}
                    </SelectItem>
                  ))}
                  {/* An existing course may hold a value outside the list; show it
                      rather than silently blanking the field on edit. */}
                  {form.semester && !SEMESTERS.includes(form.semester as any) ? (
                    <SelectItem value={form.semester}>{form.semester}</SelectItem>
                  ) : null}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="course-title">Course title</Label>
            <Input
              id="course-title"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="school">School</Label>
            <Select value={form.school} onValueChange={(value) => set("school", value)}>
              <SelectTrigger id="school" className="w-full">
                <SelectValue placeholder="Select a school" />
              </SelectTrigger>
              <SelectContent>
                {SCHOOLS.map((school) => (
                  <SelectItem key={school} value={school}>
                    {school}
                  </SelectItem>
                ))}
                {/* Same reason as semester: editing a course whose school is not
                    in the list must not lose the stored value. */}
                {form.school && !SCHOOLS.includes(form.school as any) ? (
                  <SelectItem value={form.school}>{form.school}</SelectItem>
                ) : null}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="course-description">Description</Label>
            <Textarea
              id="course-description"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="course-teacher">Assigned teacher</Label>
            <Select
              value={form.teacherId ?? UNASSIGNED}
              onValueChange={(value) => set("teacherId", value === UNASSIGNED ? null : value)}
            >
              <SelectTrigger id="course-teacher">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED}>Unassigned — assign later</SelectItem>
                {teachers.map((teacher) => (
                  <SelectItem key={teacher.id} value={teacher.id}>
                    {teacher.full_name || teacher.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              The assigned teacher owns the course and can upload materials and post to it.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="further-information">Further information</Label>
            <Textarea
              id="further-information"
              value={form.furtherInformation}
              onChange={(e) => set("furtherInformation", e.target.value)}
              rows={2}
            />
          </div>

          {error && (
            <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editing ? "Save changes" : "Create course"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
