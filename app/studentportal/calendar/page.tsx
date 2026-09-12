"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { 
  Bell, 
  Calendar as CalendarIcon, 
  Clock, 
  BookOpen,
  AlertCircle,
  Info,
  X,
  Filter,
  MapPin
} from "lucide-react"

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

type EventItem = {
  id: string
  title: string
  course: string
  date: string
  time: string
  duration: number
  type: string
  location: string
}

const MOCK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "demo-n1",
    type: "assignment",
    title: "Assignment Due Tomorrow",
    message: "React Fundamentals - Project submission due in 24 hours",
    course: "React Fundamentals",
    dueDate: "2024-01-20",
    priority: "high",
    read: false,
    createdAt: "2024-01-19T10:00:00Z",
  },
  {
    id: "demo-n2",
    type: "exam",
    title: "Midterm Exam Scheduled",
    message: "JavaScript Advanced - Midterm exam on January 25th at 2:00 PM",
    course: "JavaScript Advanced",
    dueDate: "2024-01-25",
    priority: "high",
    read: false,
    createdAt: "2024-01-18T14:30:00Z",
  },
  {
    id: "demo-n3",
    type: "reminder",
    title: "Study Session Reminder",
    message: "Don't forget your study session for Database Design tonight at 7 PM",
    course: "Database Design",
    dueDate: "2024-01-19",
    priority: "medium",
    read: true,
    createdAt: "2024-01-19T08:00:00Z",
  },
  {
    id: "demo-n4",
    type: "announcement",
    title: "Course Material Updated",
    message: "New lecture slides have been uploaded for Computer Networks",
    course: "Computer Networks",
    dueDate: null,
    priority: "low",
    read: true,
    createdAt: "2024-01-18T16:45:00Z",
  },
]

const MOCK_EVENTS: EventItem[] = [
  {
    id: "demo-e1",
    title: "React Fundamentals Lecture",
    course: "React Fundamentals",
    date: "2024-01-20",
    time: "09:00",
    duration: 90,
    type: "lecture",
    location: "Room A101",
  },
  {
    id: "demo-e2",
    title: "JavaScript Assignment Due",
    course: "JavaScript Advanced",
    date: "2024-01-20",
    time: "23:59",
    duration: 0,
    type: "assignment",
    location: "Online",
  },
  {
    id: "demo-e3",
    title: "Database Design Lab",
    course: "Database Design",
    date: "2024-01-22",
    time: "14:00",
    duration: 120,
    type: "lab",
    location: "Lab B205",
  },
  {
    id: "demo-e4",
    title: "Computer Networks Quiz",
    course: "Computer Networks",
    date: "2024-01-24",
    time: "10:30",
    duration: 60,
    type: "quiz",
    location: "Room C301",
  },
]

function courseNameFromRelation(value: any) {
  const row = Array.isArray(value) ? value[0] : value
  return row?.title || row?.code || "Course"
}

function priorityFromReminderTime(reminderTime: string): NotificationItem["priority"] {
  const diff = new Date(reminderTime).getTime() - Date.now()
  if (diff <= 24 * 60 * 60 * 1000) return "high"
  if (diff <= 72 * 60 * 60 * 1000) return "medium"
  return "low"
}

export default function CalendarNotificationsPage() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [filterType, setFilterType] = useState("all")
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [events, setEvents] = useState<EventItem[]>([])
  const [isLoadingData, setIsLoadingData] = useState(true)

  useEffect(() => {
    let mounted = true
    const supabase = createClient()

    const loadCalendarData = async () => {
      try {
        const demoResponse = await fetch("/api/demo-auth/session", { cache: "no-store" })
        const demoPayload = await demoResponse.json().catch(() => ({ isDemo: false }))
        if (!mounted) return

        if (demoPayload?.isDemo) {
          setNotifications(MOCK_NOTIFICATIONS)
          setEvents(MOCK_EVENTS)
          setIsLoadingData(false)
          return
        }

        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          setNotifications([])
          setEvents([])
          setIsLoadingData(false)
          return
        }

        const [remindersResponse, enrollmentsResult] = await Promise.all([
          fetch("/api/reminders", { cache: "no-store" }),
          supabase
            .from("course_enrollments")
            .select("course_id, courses(title, code)")
            .eq("student_id", user.id),
        ])

        const reminderPayload = await remindersResponse.json().catch(() => ({}))
        const reminders = Array.isArray(reminderPayload?.reminders) ? reminderPayload.reminders : []
        const courseIds = (enrollmentsResult.data || []).map((row: any) => row.course_id).filter(Boolean)

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

        const realEvents: EventItem[] = reminders
          .filter((reminder: any) => reminder?.reminder_time)
          .map((reminder: any) => {
            const when = new Date(reminder.reminder_time)
            return {
              id: `r-${reminder.id}`,
              title: reminder.reminder_text || "Study reminder",
              course: courseNameFromRelation(reminder.courses),
              date: when.toISOString().split("T")[0],
              time: when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }),
              duration: 0,
              type: "assignment",
              location: "Reminder",
            }
          })
          .sort((a: EventItem, b: EventItem) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))

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
          (a: NotificationItem, b: NotificationItem) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )

        if (!mounted) return
        setEvents(realEvents)
        setNotifications(mergedNotifications)
      } catch {
        if (!mounted) return
        setEvents([])
        setNotifications([])
      } finally {
        if (mounted) {
          setIsLoadingData(false)
        }
      }
    }

    void loadCalendarData()
    return () => {
      mounted = false
    }
  }, [])

  const filteredNotifications = notifications.filter(notification => {
    if (filterType === "all") return true
    if (filterType === "unread") return !notification.read
    return notification.type === filterType
  })

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "destructive"
      case "medium":
        return "secondary"
      case "low":
        return "outline"
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

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case "lecture":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
      case "assignment":
        return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
      case "lab":
        return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
      case "quiz":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400"
    }
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.3
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900">
      <motion.main 
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="container mx-auto px-4 py-6 lg:py-8 max-w-7xl"
      >
        {/* Main Content Grid - Calendar + Events Side by Side */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 mb-6 lg:mb-8">
          {/* Calendar Section */}
          <motion.div 
            variants={itemVariants}
            className="lg:col-span-2"
          >
            <div className="rounded-2xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 shadow-[8px_8px_16px_rgba(0,0,0,0.08),-8px_-8px_16px_rgba(255,255,255,0.9)] dark:shadow-[8px_8px_16px_rgba(0,0,0,0.3),-8px_-8px_16px_rgba(255,255,255,0.05)] p-4 lg:p-6">
              <div className="mb-4 lg:mb-6">
                <h2 className="text-xl lg:text-2xl font-bold text-gray-800 dark:text-gray-100 mb-1">Academic Calendar</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">View your upcoming events and deadlines</p>
              </div>
              <div className="flex justify-center">
                <div className="rounded-xl bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 shadow-[inset_4px_4px_8px_rgba(0,0,0,0.06),inset_-4px_-4px_8px_rgba(255,255,255,0.8)] dark:shadow-[inset_4px_4px_8px_rgba(0,0,0,0.3),inset_-4px_-4px_8px_rgba(255,255,255,0.05)] p-4">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    className="rounded-lg"
                  />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Upcoming Events Section */}
          <motion.div 
            variants={itemVariants}
            className="lg:col-span-1"
          >
            <div className="rounded-2xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 shadow-[8px_8px_16px_rgba(0,0,0,0.08),-8px_-8px_16px_rgba(255,255,255,0.9)] dark:shadow-[8px_8px_16px_rgba(0,0,0,0.3),-8px_-8px_16px_rgba(255,255,255,0.05)] p-4 lg:p-6 h-full">
              <div className="mb-4 lg:mb-6">
                <h2 className="text-xl lg:text-2xl font-bold text-gray-800 dark:text-gray-100 mb-1">Upcoming Events</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Your next 7 days</p>
              </div>
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {isLoadingData ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Loading events...</p>
                ) : events.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No upcoming events yet.</p>
                ) : (
                  events.slice(0, 5).map((event) => (
                  <motion.div
                    key={event.id}
                    whileHover={{ scale: 1.02, x: 4 }}
                    whileTap={{ scale: 0.98 }}
                    className="rounded-xl bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 shadow-[4px_4px_8px_rgba(0,0,0,0.06),-4px_-4px_8px_rgba(255,255,255,0.8)] dark:shadow-[4px_4px_8px_rgba(0,0,0,0.2),-4px_-4px_8px_rgba(255,255,255,0.05)] p-3 lg:p-4 border border-gray-200/50 dark:border-gray-700/50"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${getEventTypeColor(event.type)}`}>
                        {getTypeIcon(event.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm lg:text-base text-gray-800 dark:text-gray-100 mb-1 truncate">
                          {event.title}
                        </h4>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 truncate">
                          {event.course}
                        </p>
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                            <Clock className="h-3 w-3" />
                            <span>{new Date(event.date).toLocaleDateString()} at {event.time}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                            <MapPin className="h-3 w-3" />
                            <span className="truncate">{event.location}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Notifications Section */}
        <motion.div variants={itemVariants}>
          <div className="rounded-2xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 shadow-[8px_8px_16px_rgba(0,0,0,0.08),-8px_-8px_16px_rgba(255,255,255,0.9)] dark:shadow-[8px_8px_16px_rgba(0,0,0,0.3),-8px_-8px_16px_rgba(255,255,255,0.05)] p-4 lg:p-6">
            <div className="mb-4 lg:mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl lg:text-2xl font-bold text-gray-800 dark:text-gray-100 mb-1">Notifications</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Stay updated with your academic activities</p>
              </div>
              {/* Filter Controls */}
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <div className="flex gap-1.5">
                  <Button
                    variant={filterType === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilterType("all")}
                    className="text-xs h-7 px-2.5 rounded-lg shadow-[2px_2px_4px_rgba(0,0,0,0.06),-2px_-2px_4px_rgba(255,255,255,0.8)] dark:shadow-[2px_2px_4px_rgba(0,0,0,0.2),-2px_-2px_4px_rgba(255,255,255,0.05)]"
                  >
                    All
                  </Button>
                  <Button
                    variant={filterType === "unread" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilterType("unread")}
                    className="text-xs h-7 px-2.5 rounded-lg shadow-[2px_2px_4px_rgba(0,0,0,0.06),-2px_-2px_4px_rgba(255,255,255,0.8)] dark:shadow-[2px_2px_4px_rgba(0,0,0,0.2),-2px_-2px_4px_rgba(255,255,255,0.05)]"
                  >
                    Unread
                  </Button>
                  <Button
                    variant={filterType === "assignment" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilterType("assignment")}
                    className="text-xs h-7 px-2.5 rounded-lg shadow-[2px_2px_4px_rgba(0,0,0,0.06),-2px_-2px_4px_rgba(255,255,255,0.8)] dark:shadow-[2px_2px_4px_rgba(0,0,0,0.2),-2px_-2px_4px_rgba(255,255,255,0.05)]"
                  >
                    Assignments
                  </Button>
                </div>
              </div>
            </div>

            {/* Notifications List */}
            <div className="space-y-3">
              <AnimatePresence>
                {isLoadingData ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Loading notifications...</p>
                ) : filteredNotifications.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No notifications yet.</p>
                ) : (
                  filteredNotifications.map((notification) => (
                  <motion.div
                    key={notification.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    whileHover={{ scale: 1.01, x: 4 }}
                    whileTap={{ scale: 0.98 }}
                    className={`rounded-xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 shadow-[4px_4px_8px_rgba(0,0,0,0.06),-4px_-4px_8px_rgba(255,255,255,0.8)] dark:shadow-[4px_4px_8px_rgba(0,0,0,0.2),-4px_-4px_8px_rgba(255,255,255,0.05)] p-4 border-l-4 ${
                      !notification.read ? 'border-l-blue-500' : 'border-l-transparent'
                    } border border-gray-200/50 dark:border-gray-700/50`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`p-2.5 rounded-xl shadow-[inset_2px_2px_4px_rgba(0,0,0,0.1),inset_-2px_-2px_4px_rgba(255,255,255,0.5)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)] ${
                        notification.priority === "high" ? "bg-gradient-to-br from-red-100 to-red-50 dark:from-red-900/30 dark:to-red-900/10" :
                        notification.priority === "medium" ? "bg-gradient-to-br from-yellow-100 to-yellow-50 dark:from-yellow-900/30 dark:to-yellow-900/10" :
                        "bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-900/30 dark:to-gray-900/10"
                      }`}>
                        {getTypeIcon(notification.type)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-base text-gray-800 dark:text-gray-100 mb-1">
                              {notification.title}
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                              {notification.message}
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className="text-xs shadow-[inset_1px_1px_2px_rgba(0,0,0,0.06)]">
                                {notification.course}
                              </Badge>
                              <Badge variant={getPriorityColor(notification.priority)} className="text-xs">
                                {notification.priority}
                              </Badge>
                              {notification.dueDate && (
                                <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                  <Clock className="h-3 w-3" />
                                  <span>Due: {new Date(notification.dueDate).toLocaleDateString()}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {!notification.read && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_4px_rgba(59,130,246,0.5)]"></div>
                            )}
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="h-7 w-7 p-0 rounded-lg shadow-[inset_1px_1px_2px_rgba(0,0,0,0.06)] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.1)]"
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </motion.main>
    </div>
  )
}
