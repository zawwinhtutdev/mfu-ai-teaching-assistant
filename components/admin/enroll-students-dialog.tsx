"use client"

/**
 * Manage one course's roster (administrator).
 *
 * Adds and removes students. The list shown for adding excludes anyone already
 * enrolled, so the dialog cannot produce a duplicate — the database would ignore
 * it anyway, but silently ignoring a click looks like a bug.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Loader2, Search, UserMinus, UserPlus } from "lucide-react"

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

export function EnrollStudentsDialog({ open, onOpenChange, courseId, courseLabel, onChanged }: EnrollDialogProps) {
  const [enrolled, setEnrolled] = useState<StudentRow[]>([])
  const [available, setAvailable] = useState<StudentRow[]>([])
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())
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

      // The API resolves names with a service-role client. Re-querying profiles
      // from the browser would only return the caller's own row under RLS,
      // which is what made the enrolled list look empty.
      setEnrolled(Array.isArray(data?.enrolled) ? data.enrolled : [])
      setAvailable(Array.isArray(data?.available) ? data.available : [])
    } catch (cause: any) {
      setError(cause?.message || "Could not load the roster")
    } finally {
      setLoading(false)
    }
  }, [courseId])

  useEffect(() => {
    if (open) {
      setSelected(new Set())
      setSearch("")
      void load()
    }
  }, [open, load])

  const filteredAvailable = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return available
    return available.filter(
      (student) =>
        student.email.toLowerCase().includes(q) || (student.full_name || "").toLowerCase().includes(q),
    )
  }, [available, search])

  const addSelected = async () => {
    if (!courseId || selected.size === 0) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/course-enrollment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, studentIds: Array.from(selected) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Could not enrol those students")
      setSelected(new Set())
      await load()
      onChanged()
    } catch (cause: any) {
      setError(cause?.message || "Could not enrol those students")
    } finally {
      setSaving(false)
    }
  }

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
    } catch (cause: any) {
      setError(cause?.message || "Could not remove that student")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Students in {courseLabel}</DialogTitle>
          <DialogDescription>
            Add or remove students. Only accounts with the student role can be enrolled.
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
        ) : (
          <div className="space-y-6">
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

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Add students</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search students by name or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              {available.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">
                  Every student on the platform is already enrolled.
                </p>
              ) : filteredAvailable.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">
                  No student matches “{search.trim()}”.
                </p>
              ) : (
                <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
                  {filteredAvailable.map((student) => {
                    const isSelected = selected.has(student.id)
                    return (
                      <button
                        type="button"
                        key={student.id}
                        onClick={() =>
                          setSelected((prev) => {
                            const next = new Set(prev)
                            if (next.has(student.id)) next.delete(student.id)
                            else next.add(student.id)
                            return next
                          })
                        }
                        className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                          isSelected ? "border-foreground/30 bg-muted/60" : "hover:bg-muted/30"
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{student.full_name || "—"}</p>
                          <p className="truncate text-xs text-muted-foreground">{student.email}</p>
                        </div>
                        {isSelected ? (
                          <Badge className="text-[10px]">selected</Badge>
                        ) : (
                          <UserPlus className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                      </button>
                    )
                  })}
                </div>
              )}

              <Button
                type="button"
                className="w-full"
                disabled={selected.size === 0 || saving}
                onClick={addSelected}
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {selected.size === 0
                  ? "Select students to add"
                  : `Add ${selected.size} student${selected.size === 1 ? "" : "s"}`}
              </Button>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
