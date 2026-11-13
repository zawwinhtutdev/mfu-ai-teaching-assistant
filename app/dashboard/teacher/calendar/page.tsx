"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  TimelineCalendar,
  type NewTimelineTaskPayload,
  type TimelineTaskItem,
} from "@/components/calendar/timeline-calendar"
import { addDaysToLocalKey, toLocalDateKey } from "@/lib/academic-calendar"
import { sessionsToMonthItems, type ScheduledSession, type Weekday } from "@/lib/course-schedule"
import type { Course } from "@/lib/types"
import { AlertCircle, Bell, BookOpen, Calendar as CalendarIcon, Clock, Filter, Info, X } from "lucide-react"

type TeacherNotificationItem = {
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

function priorityFromReminderTime(reminderTime: string): TeacherNotificationItem["priority"] {
  const diff = new Date(reminderTime).getTime() - Date.now()
  if (diff <= 24 * 60 * 60 * 1000) return "high"
  if (diff <= 72 * 60 * 60 * 1000) return "medium"
  return "low"
}

function buildTeacherDemoItems(): {
  timeline: TimelineTaskItem[]
  notifications: TeacherNotificationItem[]
} {
  const now = new Date()
  const todayKey = toLocalDateKey(now)
  const tomorrowKey = addDaysToLocalKey(now, 1)
  const plus2Key = addDaysToLocalKey(now, 2)
  const plus3Key = addDaysToLocalKey(now, 3)

  const timeline: TimelineTaskItem[] = [
    {
      id: "demo-te1",
      kind: "event",
      title: "CSD323 Seminar Discussion (38 students)",
      metaLabel: "09:00 · CSD323 · Room C301",
      course: "CSD323",
      date: todayKey,
      time: "09:00",
      priority: "medium",
      completed: false,
      canToggle: true,
    },
    {
      id: "demo-te2",
      kind: "event",
      title: "CSD322 Lab Session — API Development",
      metaLabel: "14:00 · CSD322 · Lab B205",
      course: "CSD322",
      date: tomorrowKey,
      time: "14:00",
      priority: "medium",
      completed: false,
      canToggle: true,
    },
    {
      id: "demo-te3",
      kind: "task",
      title: "AI-EDU Workshop Session",
      metaLabel: "10:30 · AI-EDU · Training Room A",
      course: "AI-EDU",
      date: plus2Key,
      time: "10:30",
      priority: "medium",
      completed: false,
      canToggle: true,
    },
    {
      id: "demo-te4",
      kind: "task",
      title: "CSA411 Assignment Grading Due",
      metaLabel: "23:59 · CSA411 · High",
      course: "CSA411",
      date: plus3Key,
      time: "23:59",
      priority: "high",
      completed: false,
      canToggle: true,
    },
  ]

  const notifications: TeacherNotificationItem[] = [
    {
      id: "demo-tn1",
      type: "assignment",
      title: "Grading Due — CSA411",
      message: "Software Automation Testing assignments need grading.",
      course: "CSA411",
      dueDate: plus3Key,
      priority: "high",
      read: false,
      createdAt: now.toISOString(),
    },
    {
      id: "demo-tn2",
      type: "reminder",
      title: "Office Hours Reminder",
      message: "Weekly office hours for CSD322 - Platform Development today at 3 PM.",
      course: "CSD322",
      dueDate: todayKey,
      priority: "medium",
      read: true,
      createdAt: now.toISOString(),
    },
    {
      id: "demo-tn3",
      type: "announcement",
      title: "New Staff Enrollment",
      message: "3 new staff members enrolled in AI-EDU - AI for Edu week.",
      course: "AI-EDU",
      dueDate: null,
      priority: "low",
      read: true,
      createdAt: now.toISOString(),
    },
  ]

  return { timeline, notifications }
}

/**
 * Expand every scheduled class into one calendar item per week.
 *
 * The calendar shows one month at a time but is not told which month up front,
 * so a rolling window is generated: a few months back and ~14 forward. That
 * covers browsing without needing to re-fetch on every month change, and the
 * cost is small because it is pure date arithmetic.
 */
async function buildClassScheduleItems(): Promise<TimelineTaskItem[]> {
  try {
    const res = await fetch("/api/course-schedules", { cache: "no-store" })
    if (!res.ok) return []
    const payload = await res.json()
    const sessions = Array.isArray(payload?.sessions) ? payload.sessions : []
    if (sessions.length === 0) return []

    const scheduled: ScheduledSession[] = sessions.map((row: any) => ({
      courseId: row.courseId,
      courseCode: row.courseCode,
      courseTitle: row.courseTitle,
      sectionNo: row.sectionNo,
      sectionType: row.sectionType,
      room: row.room ?? null,
      schedule: {
        weekday: row.weekday as Weekday,
        startHour: row.startHour,
        endHour: row.endHour,
        raw: row.raw,
      },
    }))

    const today = new Date()
    const items: TimelineTaskItem[] = []

    // Two months back through twelve ahead: enough for term browsing in either
    // direction without generating years of events.
    for (let offset = -2; offset <= 12; offset += 1) {
      const cursor = new Date(today.getFullYear(), today.getMonth() + offset, 1)
      const monthItems = sessionsToMonthItems(scheduled, cursor.getFullYear(), cursor.getMonth() + 1)
      for (const item of monthItems) {
        items.push({
          id: item.id,
          kind: "academic",
          title: item.title,
          metaLabel: item.metaLabel,
          date: item.date,
          time: item.time,
          course: item.course,
          location: item.location,
        })
      }
    }

    return items
  } catch {
    // A schedule failure must not blank the whole calendar.
    return []
  }
}

export default function TeacherCalendarPage() {
  const [isDemo, setIsDemo] = useState(false)
  const [courses, setCourses] = useState<Course[]>([])
  const [timelineItems, setTimelineItems] = useState<TimelineTaskItem[]>([])
  const [notifications, setNotifications] = useState<TeacherNotificationItem[]>([])
  const [filterType, setFilterType] = useState("all")
  const [isLoadingData, setIsLoadingData] = useState(true)

  const loadTeacherCalendarData = useCallback(async () => {
    try {
      const demoResponse = await fetch("/api/demo-auth/session", { cache: "no-store" })
      const demoPayload = await demoResponse.json().catch(() => ({ isDemo: false }))

      if (demoPayload?.isDemo) {
        setIsDemo(true)
        const demo = buildTeacherDemoItems()
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
        setNotifications([])
        setTimelineItems([])
        setIsLoadingData(false)
        return
      }

      const [{ data: teacherCourses }, plansResponse] = await Promise.all([
        supabase.from("courses").select("*").eq("teacher_id", user.id),
        fetch("/api/study-planner", { cache: "no-store" }),
      ])

      const ownedCourses = (teacherCourses || []) as Course[]
      setCourses(ownedCourses)
      const courseMap = new Map(ownedCourses.map((c) => [c.id, c]))
      const courseIds = ownedCourses.map((c) => c.id).filter(Boolean)

      const planPayload = await plansResponse.json().catch(() => ({}))
      const plans: StudyPlanRow[] = Array.isArray(planPayload?.plans) ? planPayload.plans : []

      let reminders: any[] = []
      let announcements: any[] = []

      if (courseIds.length > 0) {
        const [{ data: remData }, { data: annData }] = await Promise.all([
          supabase
            .from("study_reminders")
            .select("id, reminder_text, reminder_time, is_completed, created_at, course_id, courses(title, code)")
            .in("course_id", courseIds)
            .order("reminder_time", { ascending: true }),
          supabase
            .from("announcements")
            .select("id, title, content, created_at, course_id, courses(title, code)")
            .in("course_id", courseIds)
            .order("created_at", { ascending: false })
            .limit(30),
        ])
        reminders = remData || []
        announcements = annData || []
      }

      const reminderItems: TimelineTaskItem[] = reminders
        .filter((r: any) => r?.reminder_time)
        .map((r: any) => {
          const when = new Date(r.reminder_time)
          const timeStr = when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
          const courseLabel = courseNameFromRelation(r.courses)
          return {
            id: `rem-${r.id}`,
            sourceId: r.id,
            kind: "reminder",
            title: r.reminder_text || "Course reminder",
            metaLabel: `${timeStr} · ${courseLabel} · Reminder`,
            course: courseLabel,
            date: toLocalDateKey(when),
            time: timeStr,
            priority: priorityFromReminderTime(r.reminder_time),
            completed: !!r.is_completed,
          }
        })

      const planItems: TimelineTaskItem[] = plans
        .filter((plan) => !!plan.due_date)
        .map((plan) => {
          const course = plan.course_id ? courseMap.get(plan.course_id) : undefined
          const courseTag = course?.code || course?.title || "Teaching"
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

      const classItems = await buildClassScheduleItems()

      const mergedTimeline = [...classItems, ...reminderItems, ...planItems, ...announcementItems].sort((a, b) =>
        `${a.date}T${a.time || "00:00"}`.localeCompare(`${b.date}T${b.time || "00:00"}`),
      )

      const reminderNotifications: TeacherNotificationItem[] = reminders.map((reminder: any) => ({
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

      const announcementNotifications: TeacherNotificationItem[] = announcements.map((announcement: any) => ({
        id: `a-${announcement.id}`,
        type: "announcement",
        title: announcement.title || "Course announcement",
        message: String(announcement.content || "").slice(0, 180) || "Course update",
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
    void loadTeacherCalendarData()
  }, [loadTeacherCalendarData])

  const handleAddTask = async (payload: NewTimelineTaskPayload) => {
    if (isDemo) {
      const course = payload.courseId ? courses.find((c) => c.id === payload.courseId) : undefined
      const courseTag = course?.code || "Teaching"
      const prioLabel = payload.priority.charAt(0).toUpperCase() + payload.priority.slice(1)
      const created: TimelineTaskItem = {
        id: `demo-tlocal-${Date.now()}`,
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
    await loadTeacherCalendarData()
  }

  const handleToggleTask = async (item: TimelineTaskItem) => {
    const nextCompleted = !item.completed
    setTimelineItems((prev) =>
      prev.map((entry) => (entry.id === item.id ? { ...entry, completed: nextCompleted } : entry)),
    )
    if (isDemo || !item.sourceId || item.kind !== "task") return

    await fetch("/api/study-planner", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: item.sourceId, completed: nextCompleted }),
    })
  }

  const handleDeleteTask = async (item: TimelineTaskItem) => {
    setTimelineItems((prev) => prev.filter((entry) => entry.id !== item.id))
    if (isDemo || !item.sourceId || item.kind !== "task") return

    await fetch("/api/study-planner", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: item.sourceId }),
    })
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
    <div className="max-w-7xl mx-auto">
      <Tabs defaultValue="calendar" className="space-y-5">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="calendar" className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4" />
            Calendar Timeline
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar">
          <TimelineCalendar
            items={timelineItems}
            courses={courses}
            isLoading={isLoadingData}
            accentColor="#a81d24"
            onAddTask={handleAddTask}
            onToggleTask={handleToggleTask}
            onDeleteTask={handleDeleteTask}
          />
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <Filter className="h-4 w-4 text-gray-500" />
                <div className="flex gap-2 flex-wrap">
                  {(
                    [
                      { id: "all", label: "All" },
                      { id: "unread", label: "Unread" },
                      { id: "assignment", label: "Grading" },
                      { id: "exam", label: "Exams" },
                    ] as const
                  ).map((opt) => (
                    <Button
                      key={opt.id}
                      variant={filterType === opt.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFilterType(opt.id)}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {isLoadingData ? (
              <p className="text-sm text-gray-500 dark:text-zinc-400">Loading notifications...</p>
            ) : filteredNotifications.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-zinc-400">No notifications yet.</p>
            ) : (
              filteredNotifications.map((notification) => (
                <Card
                  key={notification.id}
                  className={!notification.read ? "border-l-4 border-l-blue-500" : ""}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div
                        className={`p-2 rounded-lg ${
                          notification.priority === "high"
                            ? "bg-red-100 dark:bg-red-900/20"
                            : notification.priority === "medium"
                              ? "bg-yellow-100 dark:bg-yellow-900/20"
                              : "bg-gray-100 dark:bg-gray-900/20"
                        }`}
                      >
                        {getTypeIcon(notification.type)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-semibold mb-1">{notification.title}</h3>
                            <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">
                              {notification.message}
                            </p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="text-xs">
                                {notification.course}
                              </Badge>
                              <Badge variant={getPriorityColor(notification.priority)} className="text-xs">
                                {notification.priority}
                              </Badge>
                              {notification.dueDate && (
                                <div className="flex items-center gap-1 text-xs text-gray-500">
                                  <Clock className="h-3 w-3" />
                                  <span>Due: {new Date(notification.dueDate).toLocaleDateString()}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {!notification.read && <div className="w-2 h-2 bg-blue-500 rounded-full" />}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setNotifications((prev) => prev.filter((item) => item.id !== notification.id))
                              }
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
