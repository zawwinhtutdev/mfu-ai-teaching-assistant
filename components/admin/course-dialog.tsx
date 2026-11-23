"use client"

/**
 * Create or edit a course (administrator).
 *
 * Scope is deliberately narrow: identity, placement, and ownership. Grading
 * type, the credit split, and class sections were removed from this form — they
 * made creating a course a long form for values most courses never use. The
 * course record still has room for them if they are reintroduced later.
 */

import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react"
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
  /** Co-teachers, plus the primary owner, as emails. Empty means unassigned. */
  teacherEmails: string[]
}

interface CourseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When present the dialog edits; otherwise it creates. */
  course?: CourseFormValues | null
  onSaved: () => void
}

/** Semesters a course can run in. Stored as a string, like the rest of the form. */
const SEMESTERS = ["1", "2", "3"] as const

export function normalizeCourseSemester(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim()
  return (SEMESTERS as readonly string[]).includes(trimmed) ? trimmed : ""
}

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

/**
 * Email chips for co-teachers.
 *
 * An administrator types an address and presses Enter or comma to add it. Each
 * entry is validated here so an obvious typo is caught before a round trip; the
 * API is still the authority on whether the account exists and is a teacher.
 */
function TeacherEmailInput({
  emails,
  onChange,
}: {
  emails: string[]
  onChange: (emails: string[]) => void
}) {
  const [draft, setDraft] = useState("")
  const [error, setError] = useState<string | null>(null)

  const commit = (raw: string) => {
    const email = raw.trim().replace(/,$/, "").toLowerCase()
    if (!email) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("That does not look like an email address")
      return
    }
    if (emails.includes(email)) {
      setError("That teacher is already added")
      return
    }
    onChange([...emails, email])
    setDraft("")
    setError(null)
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border bg-transparent px-2 py-1.5">
        {emails.map((email) => (
          <span
            key={email}
            className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs"
          >
            {email}
            <button
              type="button"
              onClick={() => onChange(emails.filter((value) => value !== email))}
              aria-label={`Remove ${email}`}
              className="text-muted-foreground hover:text-destructive"
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value)
            setError(null)
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              // Enter would otherwise submit the form while the admin is still
              // adding a colleague.
              event.preventDefault()
              commit(draft)
            }
            if (event.key === "Backspace" && !draft && emails.length > 0) {
              onChange(emails.slice(0, -1))
            }
          }}
          onBlur={() => commit(draft)}
          placeholder={emails.length === 0 ? "teacher@mfu.ac.th" : "Add another"}
          className="min-w-[180px] flex-1 bg-transparent px-1 py-1 text-sm outline-none"
          aria-label="Teacher email"
        />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

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
    teacherEmails: [],
  }
}

export type CourseFormPanelHandle = {
  save: () => Promise<void>
}

type CourseFormPanelProps = {
  course?: CourseFormValues | null
  onSaved: () => void
  onCancel?: () => void
  idPrefix?: string
  /** When false, hide inline Save/Cancel (used on the full-page course editor). */
  showActions?: boolean
}

export const CourseFormPanel = forwardRef<CourseFormPanelHandle, CourseFormPanelProps>(function CourseFormPanel(
  { course, onSaved, onCancel, idPrefix = "course", showActions = true },
  ref,
) {
  const editing = Boolean(course?.id)
  const [form, setForm] = useState<CourseFormValues>(emptyCourse())
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const set = <K extends keyof CourseFormValues>(key: K, value: CourseFormValues[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  useEffect(() => {
    setForm(
      course
        ? { ...course, semester: normalizeCourseSemester(course.semester) }
        : emptyCourse(),
    )
    setError(null)
  }, [course])

  const persist = useCallback(async () => {
    if (!form.code.trim() || !form.title.trim()) {
      const message = "Course code and title are required"
      setError(message)
      throw new Error(message)
    }

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
        teacherEmails: form.teacherEmails,
      }

      const res = await fetch("/api/admin/courses", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Could not save the course")

      onSaved()
    } catch (cause: unknown) {
      const message = cause instanceof Error ? cause.message : "Could not save the course"
      setError(message)
      throw cause instanceof Error ? cause : new Error(message)
    } finally {
      setIsSaving(false)
    }
  }, [course, editing, form, onSaved])

  useImperativeHandle(ref, () => ({ save: persist }), [persist])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await persist()
    } catch {
      /* surfaced in panel error state */
    }
  }

  const fieldId = (name: string) => `${idPrefix}-${name}`

  return (
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor={fieldId("code")}>Course code</Label>
              <Input
                id={fieldId("code")}
                value={form.code}
                onChange={(e) => set("code", e.target.value.toUpperCase())}
                maxLength={16}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={fieldId("academic-year")}>Academic year</Label>
              <Input
                id={fieldId("academic-year")}
                value={form.academicYear}
                onChange={(e) => set("academicYear", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={fieldId("semester")}>Semester</Label>
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
                <SelectTrigger id={fieldId("semester")} className="w-full">
                  <SelectValue placeholder="Select semester" />
                </SelectTrigger>
                <SelectContent>
                  {SEMESTERS.map((semester) => (
                    <SelectItem key={semester} value={semester}>
                      {semester}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={fieldId("title")}>Course title</Label>
            <Input
              id={fieldId("title")}
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={fieldId("school")}>School</Label>
            <Select value={form.school} onValueChange={(value) => set("school", value)}>
              <SelectTrigger id={fieldId("school")} className="w-full">
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
            <Label htmlFor={fieldId("description")}>Description</Label>
            <Textarea
              id={fieldId("description")}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={fieldId("teachers")}>Assigned teachers</Label>
            <TeacherEmailInput
              emails={form.teacherEmails}
              onChange={(emails) => set("teacherEmails", emails)}
            />
            <p className="text-xs text-muted-foreground">
              Every teacher listed can upload materials and post to the course. Leave empty to
              assign later.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor={fieldId("further-information")}>Further information</Label>
            <Textarea
              id={fieldId("further-information")}
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

          {showActions ? (
            <div className="flex justify-end gap-2 pt-1">
              {onCancel ? (
                <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
                  Cancel
                </Button>
              ) : null}
              <Button type="submit" disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {editing ? "Save changes" : "Create course"}
              </Button>
            </div>
          ) : null}
        </form>
  )
})

export function CourseDialog({ open, onOpenChange, course, onSaved }: CourseDialogProps) {
  const editing = Boolean(course?.id)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit course" : "New course"}</DialogTitle>
        </DialogHeader>
        {open ? (
          <CourseFormPanel
            course={course}
            onSaved={() => {
              onOpenChange(false)
              onSaved()
            }}
            onCancel={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
