"use client"

import type React from "react"
import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { X, Plus, Search } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

interface ManageStudentsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  courseId: string
  enrolledStudents: Array<{
    id: string
    email: string
    full_name: string | null
  }>
}

export function ManageStudentsDialog({ open, onOpenChange, courseId, enrolledStudents }: ManageStudentsDialogProps) {
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
    if (!studentEmails.trim()) {
      setError("Please enter at least one email address")
      return
    }

    setIsLoading(true)
    setError(null)
    setMessage(null)

    const supabase = createClient()

    try {
      const emailList = Array.from(
        new Set(
          studentEmails
            .split(/[,\n]/)
            .map((email) => email.trim().toLowerCase())
            .filter((email) => email.length > 0 && email.includes("@")),
        ),
      )

      if (emailList.length === 0) {
        throw new Error("No valid email addresses found")
      }

      const { data: studentProfiles, error: studentLookupError } = await supabase
        .from("profiles")
        .select("id,email,role")
        .in("email", emailList)
        .eq("role", "student")

      if (studentLookupError) {
        throw studentLookupError
      }

      const students = studentProfiles || []
      if (students.length === 0) {
        throw new Error("No student accounts found for the provided email addresses.")
      }

      const enrollmentRows = students.map((student) => ({
        course_id: courseId,
        student_id: student.id,
      }))

      const { error: enrollError } = await supabase
        .from("course_enrollments")
        .upsert(enrollmentRows, { onConflict: "course_id,student_id", ignoreDuplicates: true })

      if (enrollError) {
        throw enrollError
      }

      const matchedEmails = new Set(students.map((student) => (student.email || "").toLowerCase()))
      const missingCount = emailList.filter((email) => !matchedEmails.has(email)).length

      const enrolledCount = students.length
      setMessage(
        missingCount > 0
          ? `Enrolled ${enrolledCount} student(s). ${missingCount} email(s) were not found as student accounts.`
          : `Enrolled ${enrolledCount} student(s).`,
      )

      setStudentEmails("")
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

    const supabase = createClient()

    try {
      const { error: removeError } = await supabase
        .from("course_enrollments")
        .delete()
        .eq("course_id", courseId)
        .eq("student_id", studentId)

      if (removeError) {
        throw removeError
      }

      setMessage("Student removed from course.")
      router.refresh()
    } catch (error: any) {
      setError(error.message || "Failed to remove student")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Manage Students</DialogTitle>
          <DialogDescription>
            Add or remove students from this course
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6">
          {/* Add Students Section */}
          <div className="space-y-4 border-b pb-4">
            <div className="space-y-2">
              <Label htmlFor="studentEmails">Add Students by Email</Label>
              <Textarea
                id="studentEmails"
                placeholder={`Enter email addresses (one per line or comma-separated):
6631503101@lamduan.mfu.ac.th
6631503102@lamduan.mfu.ac.th`}
                value={studentEmails}
                onChange={(e) => setStudentEmails(e.target.value)}
                rows={4}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Students will receive an invitation to enroll in this course
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
          </div>

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

            {error && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            {message && (
              <div className="rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
                {message}
              </div>
            )}

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
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveStudent(student.id)}
                      disabled={isLoading}
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
