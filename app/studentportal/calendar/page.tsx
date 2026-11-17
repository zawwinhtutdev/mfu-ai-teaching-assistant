"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  TimelineCalendar,
  type NewTimelineTaskPayload,
  type TimelineTaskItem,
} from "@/components/calendar/timeline-calendar"
import { addDaysToLocalKey, toLocalDateKey } from "@/lib/academic-calendar"
import type { Course } from "@/lib/types"
import { AlertCircle, Bell, BookOpen, Clock, Filter, Info, X } from "lucide-react"

type NotificationItem = {
  id: string
  type: string
  title: string
  message: string
  course: string
  dueDate: string | null
  priority: "high" | "medium" | "low"
  read: boolean
  createdAt: string
}

type StudyPlanRow = {
  id: string
  title: string
  description: string | null
  due_date: string | null
  priority: "low" | "medium" | "high"
  completed: boolean
  ai_generated: boolean
  course_id: string | null
}

function courseNameFromRelation(value: any) {
  const row = Array.isArray(value) ? value[0] : value
  return row?.code || row?.title || "Course"
}

function priorityFromReminderTime(reminderTime: string): NotificationItem["priority"] {
  const diff = new Date(reminderTime).getTime() - Date.now()
  if (diff <= 24 * 60 * 60 * 1000) return "high"
  if (diff <= 72 * 60 * 60 * 1000) return "medium"
  return "low"
}

function buildDemoItems(): {
  timeline: TimelineTaskItem[]
  notifications: NotificationItem[]
} {
  const now = new Date()
  const todayKey = toLocalDateKey(now)
  const tomorrowKey = addDaysToLocalKey(now, 1)
  const plus2Key = addDaysToLocalKey(now, 2)
  const plus4Key = addDaysToLocalKey(now, 4)

  const timeline: TimelineTaskItem[] = [
    {
      id: "demo-e1",
      kind: "event",
      title: "Seminar in Software Engineering Lecture",
      metaLabel: "09:00 · CSD323 · Room A101",
      course: "CSD323",
      date: todayKey,
      time: "09:00",
      priority: "medium",
      completed: false,
      canToggle: true,
    },
    {
      id: "demo-e2",
      kind: "task",
      title: "Submit Platform Development API Design",
      metaLabel: "23:59 · CSD322 · High",
      course: "CSD322",
      date: todayKey,
      time: "23:59",
      priority: "high",
      completed: false,
      canToggle: true,
    },
    {
      id: "demo-e3",
      kind: "task",
      title: "Review Business Pitch Deck Notes",
      metaLabel: "14:00 · CSB321 · Medium",
      course: "CSB321",
      date: tomorrowKey,
      time: "14:00",
      priority: "medium",
      completed: false,
      canToggle: true,
    },
    {
      id: "demo-e4",
      kind: "event",
      title: "Formal English Academic Writing Quiz",
      metaLabel: "10:30 · CSM324 · Room C301",
      course: "CSM324",
      date: plus2Key,
      time: "10:30",
      priority: "high",
      completed: false,
      canToggle: true,
    },
    {
      id: "demo-e5",
      kind: "reminder",
      title: "Group Study Session — Global Citizenship",
      metaLabel: "16:00 · GEN311 · Study",
      course: "GEN311",
      date: plus4Key,
      time: "16:00",
      priority: "low",
      completed: false,
      canToggle: true,
    },
  ]

  const notifications: NotificationItem[] = [
    {
      id: "demo-n1",
      type: "assignment",
      title: "API Design Submission Due Today",
      message: "Platform Development - Submit your API specification before 11:59 PM.",
      course: "CSD322",
      dueDate: todayKey,
      priority: "high",
      read: false,
      createdAt: now.toISOString(),
    },
    {
      id: "demo-n2",
      type: "exam",
      title: "Academic Writing Quiz Upcoming",
      message: "Introduction to Formal English quiz scheduled in Room C301 at 10:30 AM.",
      course: "CSM324",
      dueDate: plus2Key,
      priority: "high",
      read: false,
      createdAt: now.toISOString(),
    },
    {
      id: "demo-n3",
      type: "announcement",
      title: "Course Material Updated",
      message: "New lecture slides have been uploaded for Seminar in Software Engineering.",
      course: "CSD323",
      dueDate: null,
      priority: "low",
      read: true,
      createdAt: now.toISOString(),
    },
  ]

  return { timeline, notifications }
}

export default function CalendarNotificationsPage() {
  const [isDemo, setIsDemo] = useState(false)
  const [courses, setCourses] = useState<Course[]>([])
  const [timelineItems, setTimelineItems] = useState<TimelineTaskItem[]>([])
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [filterType, setFilterType] = useState("all")
  const [isLoadingData, setIsLoadingData] = useState(true)

  const loadCalendarData = useCallback(async () => {
    try {
      const demoResponse = await fetch("/api/demo-auth/session", { cache: "no-store" })
      const demoPayload = await demoResponse.json().catch(() => ({ isDemo: false }))

      if (demoPayload?.isDemo) {
        setIsDemo(true)
        const demo = buildDemoItems()
        setTimelineItems(demo.timeline)
        setNotifications(demo.notifications)
        setIsLoadingData(false)
        return
      }

      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setTimelineItems([])
        setNotifications([])
        setIsLoadingData(false)
        return
      }

      const [remindersResponse, plansResponse, enrollmentsResult] = await Promise.all([
        fetch("/api/reminders", { cache: "no-store" }),
        fetch("/api/study-planner", { cache: "no-store" }),
        supabase
          .from("course_enrollments")
          .select("course_id, courses(*)")
          .eq("student_id", user.id),
      ])

      const reminderPayload = await remindersResponse.json().catch(() => ({}))
      const planPayload = await plansResponse.json().catch(() => ({}))

      const reminders = Array.isArray(reminderPayload?.reminders) ? reminderPayload.reminders : []
      const plans: StudyPlanRow[] = Array.isArray(planPayload?.plans) ? planPayload.plans : []

      const enrolledCourses = (enrollmentsResult.data || [])
        .map((row: any) => (Array.isArray(row.courses) ? row.courses[0] : row.courses))
        .filter(Boolean) as Course[]
      setCourses(enrolledCourses)

      const courseMap = new Map(enrolledCourses.map((c) => [c.id, c]))
      const courseIds = enrolledCourses.map((c) => c.id).filter(Boolean)

      let announcements: any[] = []
      if (courseIds.length > 0) {
        const { data } = await supabase
          .from("announcements")
          .select("id, title, content, created_at, course_id, courses(title, code)")
          .in("course_id", courseIds)
          .order("created_at", { ascending: false })
          .limit(20)
        announcements = data || []
      }

      const reminderItems: TimelineTaskItem[] = reminders
        .filter((reminder: any) => reminder?.reminder_time)
        .map((reminder: any) => {
          const when = new Date(reminder.reminder_time)
          const timeStr = when.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })
          const courseLabel = courseNameFromRelation(reminder.courses)
          return {
            id: `rem-${reminder.id}`,
            sourceId: reminder.id,
            kind: "reminder",
            title: reminder.reminder_text || "Study reminder",
            metaLabel: `${timeStr} · ${courseLabel} · Reminder`,
            course: courseLabel,
            date: toLocalDateKey(when),
            time: timeStr,
            priority: priorityFromReminderTime(reminder.reminder_time),
            completed: !!reminder.is_completed,
            canToggle: true,
            canDelete: true,
          }
        })

      const planItems: TimelineTaskItem[] = plans
        .filter((plan) => !!plan.due_date)
        .map((plan) => {
          const course = plan.course_id ? courseMap.get(plan.course_id) : undefined
          const courseTag = course?.code || course?.title || "Personal"
          const prioLabel = plan.priority.charAt(0).toUpperCase() + plan.priority.slice(1)
          return {
            id: `plan-${plan.id}`,
            sourceId: plan.id,
            kind: "task",
            title: plan.title,
            description: plan.description || undefined,
            metaLabel: `${courseTag} · ${prioLabel} priority`,
            course: courseTag,
            date: String(plan.due_date).slice(0, 10),
            priority: plan.priority,
            completed: !!plan.completed,
            canToggle: true,
            canDelete: true,
          }
        })

      const announcementItems: TimelineTaskItem[] = announcements
        .filter((a: any) => a?.created_at)
        .map((a: any) => {
          const dt = new Date(a.created_at)
          const courseLabel = courseNameFromRelation(a.courses)
          return {
            id: `ann-${a.id}`,
            sourceId: a.id,
            kind: "announcement",
            title: a.title || "Course announcement",
            description: String(a.content || "").slice(0, 120) || undefined,
            metaLabel: `Announcement · ${courseLabel}`,
            course: courseLabel,
            date: toLocalDateKey(dt),
          }
        })

      const mergedTimeline = [...reminderItems, ...planItems, ...announcementItems].sort((a, b) =>
        `${a.date}T${a.time || "00:00"}`.localeCompare(`${b.date}T${b.time || "00:00"}`),
      )

      const reminderNotifications: NotificationItem[] = reminders.map((reminder: any) => ({
        id: `r-${reminder.id}`,
        type: "assignment",
        title: reminder.reminder_text || "Upcoming reminder",
        message: reminder.reminder_text || "Course reminder",
        course: courseNameFromRelation(reminder.courses),
        dueDate: reminder.reminder_time || null,
        priority: reminder.reminder_time ? priorityFromReminderTime(reminder.reminder_time) : "low",
        read: !!reminder.is_completed,
        createdAt: reminder.created_at || reminder.reminder_time || new Date().toISOString(),
      }))

      const announcementNotifications: NotificationItem[] = announcements.map((announcement: any) => ({
        id: `a-${announcement.id}`,
        type: "announcement",
        title: announcement.title || "Course announcement",
        message: String(announcement.content || "").slice(0, 160) || "New course announcement",
        course: courseNameFromRelation(announcement.courses),
        dueDate: null,
        priority: "low",
        read: false,
        createdAt: announcement.created_at || new Date().toISOString(),
      }))

      const mergedNotifications = [...reminderNotifications, ...announcementNotifications].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )

      setTimelineItems(mergedTimeline)
      setNotifications(mergedNotifications)
    } catch {
      setTimelineItems([])
      setNotifications([])
    } finally {
      setIsLoadingData(false)
    }
  }, [])

  useEffect(() => {
    void loadCalendarData()
  }, [loadCalendarData])

  const handleAddTask = async (payload: NewTimelineTaskPayload) => {
    if (isDemo) {
      const course = payload.courseId ? courses.find((c) => c.id === payload.courseId) : undefined
      const courseTag = course?.code || "Personal"
      const prioLabel = payload.priority.charAt(0).toUpperCase() + payload.priority.slice(1)
      const created: TimelineTaskItem = {
        id: `demo-local-${Date.now()}`,
        kind: "task",
        title: payload.title,
        description: payload.description,
        metaLabel: `${courseTag} · ${prioLabel} priority`,
        course: courseTag,
        date: payload.dueDate,
        priority: payload.priority,
        completed: false,
        canToggle: true,
        canDelete: true,
      }
      setTimelineItems((prev) => [...prev, created])
      return
    }

    const res = await fetch("/api/study-planner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: payload.title,
        description: payload.description,
        dueDate: payload.dueDate,
        priority: payload.priority,
        courseId: payload.courseId || null,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(data?.error || "Failed to save task")
    }
    await loadCalendarData()
  }

  const handleToggleTask = async (item: TimelineTaskItem) => {
    const nextCompleted = !item.completed
    setTimelineItems((prev) =>
      prev.map((entry) => (entry.id === item.id ? { ...entry, completed: nextCompleted } : entry)),
    )

    if (isDemo || !item.sourceId) return

    if (item.kind === "task") {
      await fetch("/api/study-planner", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: item.sourceId, completed: nextCompleted }),
      })
    } else if (item.kind === "reminder") {
      await fetch(`/api/reminders/${item.sourceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCompleted: nextCompleted }),
      })
    }
  }

  const handleDeleteTask = async (item: TimelineTaskItem) => {
    setTimelineItems((prev) => prev.filter((entry) => entry.id !== item.id))

    if (isDemo || !item.sourceId) return

    if (item.kind === "task") {
      await fetch("/api/study-planner", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: item.sourceId }),
      })
    } else if (item.kind === "reminder") {
      await fetch(`/api/reminders/${item.sourceId}`, {
        method: "DELETE",
      })
    }
  }

  const filteredNotifications = useMemo(
    () =>
      notifications.filter((notification) => {
        if (filterType === "all") return true
        if (filterType === "unread") return !notification.read
        return notification.type === filterType
      }),
    [notifications, filterType],
  )

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "destructive"
      case "medium":
        return "secondary"
      default:
        return "outline"
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "assignment":
        return <BookOpen className="h-4 w-4" />
      case "exam":
        return <AlertCircle className="h-4 w-4" />
      case "reminder":
        return <Clock className="h-4 w-4" />
      case "announcement":
        return <Info className="h-4 w-4" />
      default:
        return <Bell className="h-4 w-4" />
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <TimelineCalendar
        items={timelineItems}
        courses={courses}
        isLoading={isLoadingData}
        accentColor="#2563eb"
        onAddTask={handleAddTask}
        onToggleTask={handleToggleTask}
        onDeleteTask={handleDeleteTask}
      />

      {/* Notifications Section */}
      <div className="rounded-xl border border-[#e5e7eb] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100">Notifications</h2>
            <p className="text-xs text-gray-500 dark:text-zinc-400">
              Stay updated with your academic activities and course announcements
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <div className="flex gap-1.5">
              {(
                [
                  { id: "all", label: "All" },
                  { id: "unread", label: "Unread" },
                  { id: "assignment", label: "Assignments" },
                ] as const
              ).map((opt) => (
                <Button
                  key={opt.id}
                  variant={filterType === opt.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterType(opt.id)}
                  className="text-xs h-7 px-3"
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-2.5">
          {isLoadingData ? (
            <p className="text-sm text-gray-500 dark:text-zinc-400">Loading notifications...</p>
          ) : filteredNotifications.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-zinc-400">No notifications yet.</p>
          ) : (
            filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`rounded-lg border border-[#e5e7eb] dark:border-zinc-800 p-3.5 flex items-start gap-3.5 ${
                  !notification.read ? "border-l-4 border-l-blue-500 bg-blue-50/20 dark:bg-blue-950/10" : ""
                }`}
              >
                <div
                  className={`p-2 rounded-lg shrink-0 ${
                    notification.priority === "high"
                      ? "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                      : notification.priority === "medium"
                        ? "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
                        : "bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-300"
                  }`}
                >
                  {getTypeIcon(notification.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm text-gray-900 dark:text-zinc-100">
                        {notification.title}
                      </h3>
                      <p className="text-xs text-gray-600 dark:text-zinc-400 mt-0.5 line-clamp-2">
                        {notification.message}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-[11px]">
                          {notification.course}
                        </Badge>
                        <Badge variant={getPriorityColor(notification.priority)} className="text-[11px]">
                          {notification.priority}
                        </Badge>
                        {notification.dueDate && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-zinc-400">
                            <Clock className="h-3 w-3" />
                            Due: {new Date(notification.dueDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {!notification.read && <span className="w-2 h-2 bg-blue-500 rounded-full" />}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() =>
                          setNotifications((prev) => prev.filter((item) => item.id !== notification.id))
                        }
                        aria-label="Dismiss notification"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
