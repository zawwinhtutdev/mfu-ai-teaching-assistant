"use client"

import type React from "react"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useRouter } from "next/navigation"
import type { Course } from "@/lib/types"
import { Checkbox } from "@/components/ui/checkbox"

interface CreateReminderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  studentId: string
  courses: Course[]
  onCreated?: (reminder: any) => void
}

export function CreateReminderDialog({ open, onOpenChange, studentId, courses, onCreated }: CreateReminderDialogProps) {
  const [reminderText, setReminderText] = useState("")
  const [courseId, setCourseId] = useState("")
  const [reminderDate, setReminderDate] = useState("")
  const [reminderTime, setReminderTime] = useState("")
  const [lineEnabled, setLineEnabled] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const reminderDateTime = new Date(`${reminderDate}T${reminderTime}`)

      if (reminderDateTime < new Date()) {
        throw new Error("Reminder time must be in the future")
      }

      const response = await fetch("/api/reminders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reminderText: reminderText.trim(),
          courseId,
          reminderTime: reminderDateTime.toISOString(),
          lineEnabled,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || "Failed to create reminder")
      }

      if (onCreated && data?.reminder) {
        onCreated(data.reminder)
      }

      onOpenChange(false)
      setReminderText("")
      setCourseId("")
      setReminderDate("")
      setReminderTime("")
      setLineEnabled(false)
      router.refresh()
    } catch (error: any) {
      setError(error.message || "Failed to create reminder")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Study Reminder</DialogTitle>
          <DialogDescription>Set a reminder to help you stay on track with your studies.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reminderText">Reminder</Label>
            <Input
              id="reminderText"
              placeholder="e.g., Review lecture notes"
              value={reminderText}
              onChange={(e) => setReminderText(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="course">Course</Label>
            <Select value={courseId} onValueChange={setCourseId} required>
              <SelectTrigger>
                <SelectValue placeholder="Select a course" />
              </SelectTrigger>
              <SelectContent>
                {courses.map((course) => (
                  <SelectItem key={course.id} value={course.id}>
                    {course.title} ({course.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="reminderDate">Date</Label>
              <Input
                id="reminderDate"
                type="date"
                value={reminderDate}
                onChange={(e) => setReminderDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reminderTime">Time</Label>
              <Input
                id="reminderTime"
                type="time"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="lineEnabled"
              checked={lineEnabled}
              onCheckedChange={(checked) => setLineEnabled(checked === true)}
            />
            <Label htmlFor="lineEnabled">Also queue LINE notification (optional second channel)</Label>
          </div>
          {error && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Reminder"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
