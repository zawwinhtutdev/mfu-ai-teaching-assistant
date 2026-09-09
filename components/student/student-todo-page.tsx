"use client"

import { motion } from "framer-motion"
import { 
  CheckCircle2,
  Circle,
  Clock,
  BookOpen,
  ListTodo
} from "lucide-react"
import type { StudyReminder, Course } from "@/lib/types"

interface StudentTodoPageProps {
  reminders: StudyReminder[]
  courses: Course[]
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: "easeOut" as const }
  }
}

export function StudentTodoPage({ reminders, courses }: StudentTodoPageProps) {
  const courseMap = new Map(courses.map(c => [c.id, c]))
  const pending = reminders.filter(r => !r.is_completed)
  const completed = reminders.filter(r => r.is_completed)

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    const now = new Date()
    const diff = d.getTime() - now.getTime()
    const daysDiff = Math.ceil(diff / (1000 * 60 * 60 * 24))

    if (daysDiff < 0) return "Overdue"
    if (daysDiff === 0) return "Today"
    if (daysDiff === 1) return "Tomorrow"
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
  }

  const isOverdue = (dateStr: string) => new Date(dateStr).getTime() < Date.now()

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="container mx-auto px-4 py-6 lg:py-8 max-w-3xl"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 shadow-lg">
              <ListTodo className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              To-do
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400 ml-[52px]">
            Your upcoming tasks and reminders
          </p>
        </motion.div>

        {/* Pending Tasks */}
        {pending.length === 0 && completed.length === 0 ? (
          <motion.div variants={itemVariants}>
            <div className="rounded-2xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 shadow-[8px_8px_16px_rgba(0,0,0,0.08),-8px_-8px_16px_rgba(255,255,255,0.9)] dark:shadow-[8px_8px_16px_rgba(0,0,0,0.3),-8px_-8px_16px_rgba(255,255,255,0.05)] p-12 text-center">
              <ListTodo className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
                All caught up!
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No tasks at this time. Create reminders from your course pages.
              </p>
            </div>
          </motion.div>
        ) : (
          <>
            {pending.length > 0 && (
              <motion.div variants={itemVariants} className="mb-6">
                <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-3">
                  Pending ({pending.length})
                </h2>
                <div className="space-y-2">
                  {pending.map((reminder) => {
                    const course = courseMap.get(reminder.course_id)
                    const overdue = isOverdue(reminder.reminder_time)
                    return (
                      <motion.div key={reminder.id} variants={itemVariants}>
                        <div className={`rounded-xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 shadow-[4px_4px_8px_rgba(0,0,0,0.06),-4px_-4px_8px_rgba(255,255,255,0.8)] dark:shadow-[4px_4px_8px_rgba(0,0,0,0.2),-4px_-4px_8px_rgba(255,255,255,0.05)] p-4 border border-gray-200/50 dark:border-gray-700/50 ${overdue ? 'border-l-4 border-l-red-400' : ''}`}>
                          <div className="flex items-start gap-3">
                            <Circle className={`h-5 w-5 mt-0.5 flex-shrink-0 ${overdue ? 'text-red-400' : 'text-gray-400'}`} />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 dark:text-gray-100">
                                {reminder.reminder_text}
                              </p>
                              <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                                {course && (
                                  <span className="flex items-center gap-1">
                                    <BookOpen className="h-3 w-3" />
                                    {course.code}
                                  </span>
                                )}
                                <span className={`flex items-center gap-1 ${overdue ? 'text-red-500 font-medium' : ''}`}>
                                  <Clock className="h-3 w-3" />
                                  {formatDate(reminder.reminder_time)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </motion.div>
            )}

            {completed.length > 0 && (
              <motion.div variants={itemVariants}>
                <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-3">
                  Completed ({completed.length})
                </h2>
                <div className="space-y-2">
                  {completed.map((reminder) => {
                    const course = courseMap.get(reminder.course_id)
                    return (
                      <motion.div key={reminder.id} variants={itemVariants}>
                        <div className="rounded-xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 shadow-[2px_2px_4px_rgba(0,0,0,0.04),-2px_-2px_4px_rgba(255,255,255,0.6)] dark:shadow-[2px_2px_4px_rgba(0,0,0,0.15),-2px_-2px_4px_rgba(255,255,255,0.03)] p-4 opacity-60">
                          <div className="flex items-start gap-3">
                            <CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0 text-green-500" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-600 dark:text-gray-400 line-through">
                                {reminder.reminder_text}
                              </p>
                              <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                                {course && (
                                  <span className="flex items-center gap-1">
                                    <BookOpen className="h-3 w-3" />
                                    {course.code}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </motion.div>
            )}
          </>
        )}
      </motion.div>
    </div>
  )
}
