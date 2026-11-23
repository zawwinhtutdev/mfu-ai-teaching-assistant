"use client"

import type React from "react"
import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { X, Plus, Search, Mail } from "lucide-react"
import { useRouter } from "next/navigation"

/**
 * DD/MM/YYYY from UTC.
 *
 * Not `toLocaleDateString`: server and browser default locales can differ, which
 * makes the rendered string differ and triggers a React hydration mismatch.
 */
function formatEnrolledDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}`
}

interface PendingInvitation {
  id: string
  email: string
  created_at?: string | null
}

interface ManageStudentsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  courseId: string
  enrolledStudents: Array<{
    id: string
    email: string
    full_name: string | null
    enrolled_at?: string | null
  }>
  /** Invitations waiting for the address to sign in for the first time. */
  pendingInvitations?: PendingInvitation[]
}

type AddStudentsResponse = {
  enrolled?: string[]
  invited?: string[]
  alreadyEnrolled?: string[]
  alreadyInvited?: string[]
  skipped?: Array<{ email: string; reason: string }>
}

export function ManageStudentsDialog({
  open,
  onOpenChange,
  courseId,
  enrolledStudents,
  pendingInvitations = [],
}: ManageStudentsDialogProps) {
  const [studentEmails, setStudentEmails] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  // Filter students based on search query
  const filteredStudents = enrolledStudents.filter((student) => {
    const query = searchQuery.toLowerCase()
    return (
      student.email.toLowerCase().includes(query) ||
      (student.full_name && student.full_name.toLowerCase().includes(query))
    )
  })

  const handleAddStudents = async () => {
    const emailList = Array.from(
      new Set(
        studentEmails
          .split(/[,\n;]/)
          .map((email) => email.trim().toLowerCase())
          .filter((email) => email.length > 0),
      ),
    )

    if (emailList.length === 0) {
      setError("Please enter at least one email address")
      return
    }

    setIsLoading(true)
    setError(null)
    setMessage(null)

    try {
      // The browser cannot read un-enrolled profiles or insert enrolments (RLS),
      // so the server resolves the addresses and either enrols an existing
      // student or stores an invitation for a new one.
      const response = await fetch(
        `/api/teacher/courses/${encodeURIComponent(courseId)}/students`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emails: emailList }),
        },
      )
      const payload = (await response.json().catch(() => ({}))) as AddStudentsResponse & {
        error?: string
      }

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to add students")
      }

      const enrolled = payload.enrolled ?? []
      const invited = payload.invited ?? []
      const alreadyEnrolled = payload.alreadyEnrolled ?? []
      const alreadyInvited = payload.alreadyInvited ?? []
      const skipped = payload.skipped ?? []

      const parts: string[] = []
      if (enrolled.length > 0) {
        parts.push(`Enrolled ${enrolled.length} student${enrolled.length === 1 ? "" : "s"}.`)
      }
      if (invited.length > 0) {
        parts.push(
          `Invited ${invited.length} student${invited.length === 1 ? "" : "s"} — enrolled automatically after their first sign-in.`,
        )
      }
      if (alreadyEnrolled.length > 0) {
        parts.push(`${alreadyEnrolled.length} already enrolled.`)
      }
      if (alreadyInvited.length > 0) {
        parts.push(`${alreadyInvited.length} already invited.`)
      }

      setMessage(parts.length > 0 ? parts.join(" ") : null)
      setError(
        skipped.length > 0
          ? skipped.map((entry) => `${entry.email}: ${entry.reason}`).join(" ")
          : null,
      )

      // Keep only the addresses that still need the teacher's attention, so a
      // single typo does not force re-typing the whole batch.
      setStudentEmails(skipped.map((entry) => entry.email).join("\n"))
      router.refresh()
    } catch (error: any) {
      setError(error.message || "Failed to add students")
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemoveStudent = async (studentId: string) => {
    setIsLoading(true)
    setError(null)
    setMessage(null)

    try {
      const response = await fetch(
        `/api/teacher/courses/${encodeURIComponent(courseId)}/students?studentId=${encodeURIComponent(studentId)}`,
        { method: "DELETE" },
      )
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to remove student")
      }

      setMessage("Student removed from course.")
      router.refresh()
    } catch (error: any) {
      setError(error.message || "Failed to remove student")
    } finally {
      setIsLoading(false)
    }
  }

  const handleRevokeInvitation = async (invitationId: string) => {
    setIsLoading(true)
    setError(null)
    setMessage(null)

    try {
      const response = await fetch(
        `/api/teacher/courses/${encodeURIComponent(courseId)}/students?invitationId=${encodeURIComponent(invitationId)}`,
        { method: "DELETE" },
      )
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to revoke invitation")
      }

      setMessage("Invitation revoked.")
      router.refresh()
    } catch (error: any) {
      setError(error.message || "Failed to revoke invitation")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Manage Students</DialogTitle>
          <DialogDescription>Add or remove students from this course</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6">
          {/* Add Students Section */}
          <div className="space-y-4 border-b pb-4">
            <div className="space-y-2">
              <Label htmlFor="studentEmails">Add Students by Email</Label>
              <Textarea
                id="studentEmails"
                placeholder={`Enter email addresses (one per line or comma-separated):
6531503101@lamduan.mfu.ac.th
6531503102@lamduan.mfu.ac.th`}
                value={studentEmails}
                onChange={(e) => setStudentEmails(e.target.value)}
                rows={4}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Students with an account are enrolled immediately. New addresses are invited and
                enrolled automatically the first time they sign in.
              </p>
            </div>
            <Button
              onClick={handleAddStudents}
              disabled={isLoading || !studentEmails.trim()}
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Students
            </Button>

            {error && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
            )}
            {message && (
              <div className="rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
                {message}
              </div>
            )}
          </div>

          {/* Pending invitations: these addresses get enrolled at signup. */}
          {pendingInvitations.length > 0 && (
            <div className="space-y-2 border-b pb-4">
              <Label>Pending Invitations ({pendingInvitations.length})</Label>
              <p className="text-xs text-muted-foreground">
                These students will be enrolled automatically after their first sign-in.
              </p>
              <div className="space-y-2">
                {pendingInvitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-dashed bg-card px-3 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{invitation.email}</p>
                        <p className="truncate text-[11px] text-muted-foreground/70">
                          {invitation.created_at
                            ? `Invited ${formatEnrolledDate(invitation.created_at)}`
                            : "Waiting for first sign-in"}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRevokeInvitation(invitation.id)}
                      disabled={isLoading}
                      aria-label={`Revoke invitation for ${invitation.email}`}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Current Students List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Enrolled Students ({enrolledStudents.length})</Label>
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search students..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filteredStudents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchQuery ? "No students found" : "No students enrolled yet"}
                </div>
              ) : (
                filteredStudents.map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{student.full_name || "Unknown"}</p>
                      <p className="text-sm text-muted-foreground">{student.email}</p>
                      {student.enrolled_at && (
                        <p className="text-[11px] text-muted-foreground/70">
                          Enrolled {formatEnrolledDate(student.enrolled_at)}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveStudent(student.id)}
                      disabled={isLoading}
                      aria-label={`Remove ${student.email} from the course`}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
