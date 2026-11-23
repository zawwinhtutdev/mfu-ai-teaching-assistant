"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { UserMinus, UserPlus } from "lucide-react"

export type EnrollmentStudent = {
  id: string
  full_name: string | null
  email: string
  role: string
  enrolled_at?: string | null
  section_id?: string | null
}

export type EnrollmentCatalog = {
  enrolled: EnrollmentStudent[]
  available: EnrollmentStudent[]
}

export function SectionStudentsBlock({
  courseId,
  sectionId,
  sectionNo,
  capacity,
  catalog,
  sectionNoById,
  onChanged,
  onAssignBySectionNo,
  onBulkAssignToSection,
}: {
  courseId: string
  sectionId?: string
  sectionNo: string
  capacity: number
  catalog: EnrollmentCatalog
  sectionNoById: Map<string, string>
  onChanged: () => void
  onAssignBySectionNo?: (studentId: string, sectionNo: string) => Promise<void>
  onBulkAssignToSection?: (studentIds: string[], sectionNo: string) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [addEmail, setAddEmail] = useState("")

  const roster = useMemo(() => {
    if (!sectionId) return []
    return catalog.enrolled.filter((student) => student.section_id === sectionId)
  }, [catalog.enrolled, sectionId])

  const enrolledNotInSection = useMemo(() => {
    return catalog.enrolled.filter((student) => {
      if (sectionId) return student.section_id !== sectionId
      return !student.section_id || !sectionNoById.has(student.section_id)
    })
  }, [catalog.enrolled, sectionId, sectionNoById])

  const addAllEnrolledToSection = async () => {
    const ids = enrolledNotInSection.map((s) => s.id)
    if (ids.length === 0) return
    setSaving(true)
    setError(null)
    try {
      if (sectionId) {
        const res = await fetch("/api/admin/course-enrollment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courseId, studentIds: ids, sectionId }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error || "Could not add those students")
      } else if (onBulkAssignToSection) {
        await onBulkAssignToSection(ids, sectionNo)
      } else if (onAssignBySectionNo) {
        await onAssignBySectionNo(ids[0]!, sectionNo)
      } else {
        throw new Error("Save this section first, then try again.")
      }
      onChanged()
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not add those students")
    } finally {
      setSaving(false)
    }
  }

  const addToThisSection = async (studentId: string) => {
    setSaving(true)
    setError(null)
    try {
      if (sectionId) {
        const res = await fetch("/api/admin/course-enrollment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courseId, studentIds: [studentId], sectionId }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error || "Could not add that student")
      } else if (onAssignBySectionNo) {
        await onAssignBySectionNo(studentId, sectionNo)
      } else {
        throw new Error("Save this section first, then try again.")
      }
      onChanged()
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not add that student")
    } finally {
      setSaving(false)
    }
  }

  const addByEmail = async () => {
    setError(null)
    const email = addEmail.trim().toLowerCase()
    if (!email) {
      setError("Enter a student email.")
      return
    }

    const pool = [...catalog.enrolled, ...catalog.available]
    const student = pool.find((row) => row.email.toLowerCase() === email)
    if (!student) {
      setError("No student account with that email.")
      return
    }
    if (sectionId && student.section_id === sectionId) {
      setError("That student is already in this section.")
      return
    }

    setAddEmail("")
    await addToThisSection(student.id)
  }

  const removeStudent = async (studentId: string) => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/admin/course-enrollment?courseId=${courseId}&studentId=${studentId}`,
        { method: "DELETE" },
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Could not remove that student")
      onChanged()
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not remove that student")
    } finally {
      setSaving(false)
    }
  }

  const atCapacity = capacity > 0 && roster.length >= capacity

  return (
    <div className="mt-3 space-y-3 border-t pt-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Students ({roster.length}
          {capacity > 0 ? ` / ${capacity}` : ""})
        </h4>
        {atCapacity ? (
          <span className="text-[11px] text-amber-700 dark:text-amber-400">Section is full</span>
        ) : null}
      </div>

      {roster.length === 0 ? (
        <p className="text-xs text-muted-foreground">No students in this section yet.</p>
      ) : (
        <div className="space-y-1.5">
          {roster.map((student) => (
            <div
              key={student.id}
              className="flex items-center justify-between gap-3 rounded-md border bg-muted/20 px-2.5 py-1.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{student.full_name || "—"}</p>
                <p className="truncate text-[11px] text-muted-foreground">{student.email}</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={saving}
                onClick={() => void removeStudent(student.id)}
                aria-label={`Remove ${student.full_name || student.email} from course`}
                title="Remove from course"
              >
                <UserMinus className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {error ? (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      {!atCapacity ? (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground">Add student</p>
          <div className="flex gap-2">
            <Input
              type="email"
              value={addEmail}
              onChange={(e) => setAddEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  void addByEmail()
                }
              }}
              placeholder="Student email"
              className="h-9 flex-1 text-sm"
              disabled={saving}
              autoComplete="off"
            />
            <Button
              type="button"
              size="sm"
              className="h-9 shrink-0"
              disabled={saving || !addEmail.trim()}
              onClick={() => void addByEmail()}
            >
              <UserPlus className="mr-1 h-3.5 w-3.5" />
              Add
            </Button>
          </div>
        </div>
      ) : null}

      {enrolledNotInSection.length > 0 ? (
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-medium text-muted-foreground">
              On course — add to section {sectionNo} ({enrolledNotInSection.length})
            </p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-7 text-xs"
              disabled={saving || atCapacity}
              onClick={() => void addAllEnrolledToSection()}
            >
              Add all to section {sectionNo}
            </Button>
          </div>
          <div className="space-y-1">
            {enrolledNotInSection.map((student) => {
              const otherSection =
                student.section_id && student.section_id !== sectionId
                  ? sectionNoById.get(student.section_id)
                  : null
              return (
                <button
                  key={student.id}
                  type="button"
                  disabled={saving || atCapacity}
                  onClick={() => void addToThisSection(student.id)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-dashed px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted/40 disabled:opacity-50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{student.full_name || "—"}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{student.email}</p>
                    {otherSection ? (
                      <p className="text-[10px] text-amber-700 dark:text-amber-400">
                        Moves from section {otherSection}
                      </p>
                    ) : null}
                  </div>
                  <UserPlus className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}