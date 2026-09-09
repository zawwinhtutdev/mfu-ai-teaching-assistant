"use client"

import type React from "react"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

interface EnrollCourseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  studentId: string
}

export function EnrollCourseDialog({ open, onOpenChange, studentId }: EnrollCourseDialogProps) {
  const [courseCode, setCourseCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const supabase = createClient()

    try {
      // Find course by code
      const { data: course, error: courseError } = await supabase
        .from("courses")
        .select("id")
        .eq("code", courseCode.trim())
        .single()

      if (courseError || !course) {
        throw new Error("Course not found. Please check the course code.")
      }

      // Enroll in course
      const { error: enrollError } = await supabase.from("course_enrollments").insert({
        course_id: course.id,
        student_id: studentId,
      })

      if (enrollError) {
        if (enrollError.code === "23505") {
          throw new Error("You are already enrolled in this course.")
        }
        throw enrollError
      }

      onOpenChange(false)
      setCourseCode("")
      router.refresh()
    } catch (error: any) {
      setError(error.message || "Failed to enroll in course")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enroll in a Course</DialogTitle>
          <DialogDescription>Enter the course code provided by your teacher to enroll.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleEnroll} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="courseCode">Course Code</Label>
            <Input
              id="courseCode"
              placeholder="e.g., CS101"
              value={courseCode}
              onChange={(e) => setCourseCode(e.target.value)}
              required
            />
          </div>
          {error && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Enrolling..." : "Enroll"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
