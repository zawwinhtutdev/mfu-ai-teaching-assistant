"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence, LazyMotion, domAnimation } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar } from "@/components/ui/calendar"
import { 
  Bell, 
  Calendar as CalendarIcon, 
  Clock, 
  BookOpen,
  CheckCircle,
  AlertCircle,
  Info,
  X,
  Filter,
  Users,
  GraduationCap
} from "lucide-react"

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

type TeacherEventItem = {
  id: string
  title: string
  course: string
  date: string
  time: string
  duration: number
  type: string
  location: string
  students?: number
}

const MOCK_NOTIFICATIONS: TeacherNotificationItem[] = [
  {
    id: "demo-tn1",
    type: "assignment",
    title: "Grading Due - CSA411",
    message: "Software Automation Testing assignments need grading by November 16th",
    course: "CSA411",
    dueDate: "2025-11-16",
    priority: "high",
    read: false,
    createdAt: "2025-11-14T10:00:00Z",
  },
  {
    id: "demo-tn2",
    type: "exam",
    title: "Midterm Preparation - CSD323",
    message: "Seminar in Software Engineering midterm presentation scheduled for December 1st at 2:00 PM",
    course: "CSD323",
    dueDate: "2025-12-01",
    priority: "high",
    read: false,
    createdAt: "2025-11-13T14:30:00Z",
  },
  {
    id: "demo-tn3",
    type: "reminder",
    title: "Office Hours Reminder",
    message: "Weekly office hours for CSD322 - Platform Development today at 3 PM",
    course: "CSD322",
    dueDate: new Date().toISOString().split("T")[0],
    priority: "medium",
    read: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "demo-tn4",
    type: "announcement",
    title: "New Staff Enrollment",
    message: "3 new staff members enrolled in AI-EDU - AI for Edu week",
    course: "AI-EDU",
    dueDate: null,
    priority: "low",
    read: true,
    createdAt: "2025-11-12T16:45:00Z",
  },
]

const MOCK_EVENTS: TeacherEventItem[] = [
  {
    id: "demo-te1",
    title: "CSD323 Seminar Discussion",
    course: "CSD323",
    date: "2025-11-17",
    time: "09:00",
    duration: 90,
    type: "seminar",
    location: "Room C301",
    students: 38,
  },
  {
    id: "demo-te2",
    title: "CSD322 Lab Session - API Development",
    course: "CSD322",
    date: "2025-11-18",
    time: "14:00",
    duration: 120,
    type: "lab",
    location: "Lab B205",
    students: 42,
  },
  {
    id: "demo-te3",
    title: "CSA411 Assignment Grading Due",
    course: "CSA411",
    date: "2025-11-20",
    time: "23:59",
    duration: 0,
    type: "grading",
    location: "Online",
    students: 32,
  },
  {
    id: "demo-te4",
    title: "AI-EDU Workshop Session",
    course: "AI-EDU",
    date: "2025-11-19",
    time: "10:30",
    duration: 120,
    type: "workshop",
    location: "Training Room A",
    students: 25,
  },
]

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

export default function TeacherCalendarPage() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [filterType, setFilterType] = useState("all")
  const [notifications, setNotifications] = useState<TeacherNotificationItem[]>([])
  const [events, setEvents] = useState<TeacherEventItem[]>([])
  const [isLoadingData, setIsLoadingData] = useState(true)

  useEffect(() => {
    let mounted = true
    const supabase = createClient()

    const loadTeacherCalendarData = async () => {
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

        const { data: courses } = await supabase
          .from("courses")
          .select("id, title, code")
          .eq("teacher_id", user.id)

        const courseIds = (courses || []).map((course: any) => course.id).filter(Boolean)
        if (courseIds.length === 0) {
          setNotifications([])
          setEvents([])
          setIsLoadingData(false)
          return
        }

        const [{ data: reminders }, { data: announcements }] = await Promise.all([
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

        const realEvents: TeacherEventItem[] = (reminders || [])
          .filter((reminder: any) => reminder?.reminder_time)
          .map((reminder: any) => {
            const when = new Date(reminder.reminder_time)
            return {
              id: `r-${reminder.id}`,
              title: reminder.reminder_text || "Reminder",
              course: courseNameFromRelation(reminder.courses),
              date: when.toISOString().split("T")[0],
              time: when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }),
              duration: 0,
              type: "grading",
              location: "Reminder",
            }
          })
          .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))

        const reminderNotifications: TeacherNotificationItem[] = (reminders || []).map((reminder: any) => ({
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

        const announcementNotifications: TeacherNotificationItem[] = (announcements || []).map((announcement: any) => ({
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

        if (!mounted) return
        setEvents(realEvents)
        setNotifications(mergedNotifications)
      } catch {
        if (!mounted) return
        setNotifications([])
        setEvents([])
      } finally {
        if (mounted) {
          setIsLoadingData(false)
        }
      }
    }

    void loadTeacherCalendarData()
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
      case "grading":
        return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
      case "lab":
        return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
      case "seminar":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400"
    }
  }

  // Reduced animation durations for better performance
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.03,
        duration: 0.2
      }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.2
      }
    }
  }

  const cardVariants = {
    hidden: { opacity: 0, scale: 0.98 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.2
      }
    },
    hover: {
      scale: 1.01,
      transition: {
        duration: 0.15
      }
    }
  }

  return (
    <LazyMotion features={domAnimation}>
      <motion.div 
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="container mx-auto flex-1 px-4 py-8"
    >
        {/* Main Content */}
        <motion.div variants={itemVariants}>
          <Tabs defaultValue="calendar" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="calendar" className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                Calendar
              </TabsTrigger>
              <TabsTrigger value="notifications" className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Notifications
              </TabsTrigger>
            </TabsList>

            {/* Calendar Tab */}
            <TabsContent value="calendar">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Calendar */}
                <div>
                  <Card>
                    <CardContent className="p-8">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        className="rounded-md border w-full"
                      />
                    </CardContent>
                  </Card>
                </div>

                {/* Upcoming Events */}
                <div>
                  <Card>
                    <CardHeader>
                      <CardTitle>Upcoming Events</CardTitle>
                      <CardDescription>
                        Your next 7 days
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {isLoadingData ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">Loading events...</p>
                      ) : events.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">No upcoming events yet.</p>
                      ) : (
                        events.slice(0, 5).map((event) => (
                        <motion.div
                          key={event.id}
                          variants={cardVariants}
                          initial="hidden"
                          animate="visible"
                          whileHover="hover"
                        >
                          <div className="p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h4 className="font-medium text-sm">{event.title}</h4>
                                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                                  {event.course}
                                </p>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`px-2 py-1 rounded text-xs ${getEventTypeColor(event.type)}`}>
                                    {event.type}
                                  </span>
                                  {event.students && (
                                    <span className="text-xs text-gray-500 flex items-center gap-1">
                                      <Users className="h-3 w-3" />
                                      {event.students}
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs text-gray-500 block mt-1">
                                  {new Date(event.date).toLocaleDateString()} at {event.time}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {event.location}
                                </span>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* Notifications Tab */}
            <TabsContent value="notifications">
              <div className="space-y-6">
                {/* Filter Controls */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <Filter className="h-5 w-5 text-gray-500" />
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          variant={filterType === "all" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setFilterType("all")}
                        >
                          All
                        </Button>
                        <Button
                          variant={filterType === "unread" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setFilterType("unread")}
                        >
                          Unread
                        </Button>
                        <Button
                          variant={filterType === "assignment" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setFilterType("assignment")}
                        >
                          Grading
                        </Button>
                        <Button
                          variant={filterType === "exam" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setFilterType("exam")}
                        >
                          Exams
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Notifications List */}
                <div className="space-y-4">
                  <AnimatePresence>
                    {isLoadingData ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400">Loading notifications...</p>
                    ) : filteredNotifications.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400">No notifications yet.</p>
                    ) : (
                      filteredNotifications.map((notification) => (
                      <motion.div
                        key={notification.id}
                        variants={cardVariants}
                        initial="hidden"
                        animate="visible"
                        exit={{ opacity: 0, scale: 0.9 }}
                        whileHover="hover"
                      >
                        <Card className={`transition-all ${!notification.read ? 'border-l-4 border-l-blue-500' : ''}`}>
                          <CardContent className="p-4">
                            <div className="flex items-start gap-4">
                              <div className={`p-2 rounded-lg ${
                                notification.priority === "high" ? "bg-red-100 dark:bg-red-900/20" :
                                notification.priority === "medium" ? "bg-yellow-100 dark:bg-yellow-900/20" :
                                "bg-gray-100 dark:bg-gray-900/20"
                              }`}>
                                {getTypeIcon(notification.type)}
                              </div>
                              
                              <div className="flex-1">
                                <div className="flex items-start justify-between">
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
                                    {!notification.read && (
                                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                    )}
                                    <Button variant="ghost" size="sm">
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                      ))
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </motion.div>
    </LazyMotion>
  )
}
