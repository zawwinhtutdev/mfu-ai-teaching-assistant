"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Plus, Calendar, CheckCircle2, Trash2 } from "lucide-react"
import Link from "next/link"
import type { Course } from "@/lib/types"
import { CreateReminderDialog } from "./create-reminder-dialog"
import { useRouter } from "next/navigation"

interface RemindersPageProps {
  studentId: string
  courses: Course[]
  reminders: any[]
}

export function RemindersPage({ studentId, courses, reminders: initialReminders }: RemindersPageProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [reminders, setReminders] = useState(initialReminders)
  const router = useRouter()

  const handleComplete = async (reminderId: string) => {
    const response = await fetch(`/api/reminders/${reminderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isCompleted: true }),
    })

    if (!response.ok) {
      return
    }

    const data = await response.json()
    if (data?.reminder) {
      setReminders((prev) => prev.map((r) => (r.id === reminderId ? data.reminder : r)))
    }
    router.refresh()
  }

  const handleDelete = async (reminderId: string) => {
    const response = await fetch(`/api/reminders/${reminderId}`, { method: "DELETE" })
    if (!response.ok) {
      return
    }
    setReminders((prev) => prev.filter((r) => r.id !== reminderId))
    router.refresh()
  }

  const upcomingReminders = reminders.filter((r) => !r.is_completed && new Date(r.reminder_time) > new Date())
  const completedReminders = reminders.filter((r) => r.is_completed)

  return (
    <div className="space-y-6">

      <div>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Manage Your Study Schedule</h2>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Reminder
          </Button>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="mb-4 text-lg font-semibold">Upcoming Reminders</h3>
            {upcomingReminders.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Calendar className="mb-4 h-12 w-12 text-muted-foreground" />
                  <h3 className="mb-2 text-lg font-semibold">No upcoming reminders</h3>
                  <Button onClick={() => setShowCreateDialog(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Reminder
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {upcomingReminders.map((reminder) => (
                  <Card key={reminder.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle>{reminder.reminder_text}</CardTitle>
                          <CardDescription>
                            {reminder.courses?.title} ({reminder.courses?.code}) •{" "}
                            {new Date(reminder.reminder_time).toLocaleString()}
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="icon" onClick={() => handleComplete(reminder.id)}>
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="icon" onClick={() => handleDelete(reminder.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {completedReminders.length > 0 && (
            <div>
              <h3 className="mb-4 text-lg font-semibold">Completed</h3>
              <div className="grid gap-4">
                {completedReminders.map((reminder) => (
                  <Card key={reminder.id} className="opacity-60">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="line-through">{reminder.reminder_text}</CardTitle>
                          <CardDescription>
                            {reminder.courses?.title} ({reminder.courses?.code}) •{" "}
                            {new Date(reminder.reminder_time).toLocaleString()}
                          </CardDescription>
                        </div>
                        <Button variant="outline" size="icon" onClick={() => handleDelete(reminder.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <CreateReminderDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        studentId={studentId}
        courses={courses}
        onCreated={(reminder) => setReminders((prev) => [...prev, reminder])}
      />
    </div>
  )
}
