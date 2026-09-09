"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import { 
  BarChart3, 
  MessageSquare, 
  BookOpen, 
  Clock,
  TrendingUp,
  Calendar,
  Award
} from "lucide-react"
import type { Profile, Course } from "@/lib/types"

interface StudentAnalyticsDashboardProps {
  profile: Profile
  courses: Course[]
}

interface AnalyticsData {
  totalChats: number
  totalReminders: number
  coursesEnrolled: number
  recentActivity: { date: string; count: number }[]
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" as const }
  }
}

export function StudentAnalyticsDashboard({ profile, courses }: StudentAnalyticsDashboardProps) {
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalChats: 0,
    totalReminders: 0,
    coursesEnrolled: courses.length,
    recentActivity: []
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const supabase = createClient()

    async function loadAnalytics() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || !mounted) return

        // Count chat conversations
        const { count: chatCount } = await supabase
          .from("conversations")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)

        // Count reminders
        const { count: reminderCount } = await supabase
          .from("study_reminders")
          .select("*", { count: "exact", head: true })
          .eq("student_id", user.id)

        if (!mounted) return
        setAnalytics({
          totalChats: chatCount || 0,
          totalReminders: reminderCount || 0,
          coursesEnrolled: courses.length,
          recentActivity: []
        })
      } catch {
        // Silently handle errors
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    loadAnalytics()
    return () => { mounted = false }
  }, [courses.length])

  const statCards = [
    {
      label: "Courses Enrolled",
      value: analytics.coursesEnrolled,
      icon: BookOpen,
      color: "from-blue-500 to-blue-600",
      bgLight: "from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20"
    },
    {
      label: "AI Conversations",
      value: analytics.totalChats,
      icon: MessageSquare,
      color: "from-purple-500 to-purple-600",
      bgLight: "from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20"
    },
    {
      label: "Study Reminders",
      value: analytics.totalReminders,
      icon: Clock,
      color: "from-amber-500 to-amber-600",
      bgLight: "from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20"
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="container mx-auto px-4 py-6 lg:py-8 max-w-5xl"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg">
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-gray-100">
              My Analytics
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400 ml-[52px]">
            Track your learning activity and engagement across courses.
          </p>
        </motion.div>

        {/* Stat Cards */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {statCards.map((stat) => {
            const Icon = stat.icon
            return (
              <div
                key={stat.label}
                className="rounded-2xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 shadow-[8px_8px_16px_rgba(0,0,0,0.08),-8px_-8px_16px_rgba(255,255,255,0.9)] dark:shadow-[8px_8px_16px_rgba(0,0,0,0.3),-8px_-8px_16px_rgba(255,255,255,0.05)] p-5"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 rounded-xl bg-gradient-to-br ${stat.bgLight}`}>
                    <Icon className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                  </div>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{stat.label}</span>
                </div>
                <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {isLoading ? (
                    <div className="h-9 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  ) : (
                    stat.value
                  )}
                </div>
              </div>
            )
          })}
        </motion.div>

        {/* Course Breakdown */}
        <motion.div variants={itemVariants}>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Course Overview
          </h2>

          {courses.length === 0 ? (
            <div className="rounded-2xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 shadow-[8px_8px_16px_rgba(0,0,0,0.08),-8px_-8px_16px_rgba(255,255,255,0.9)] dark:shadow-[8px_8px_16px_rgba(0,0,0,0.3),-8px_-8px_16px_rgba(255,255,255,0.05)] p-12 text-center">
              <Award className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
                No courses yet
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Enroll in courses to see your analytics.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {courses.map((course) => (
                <motion.div
                  key={course.id}
                  variants={itemVariants}
                  className="rounded-xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 shadow-[4px_4px_8px_rgba(0,0,0,0.06),-4px_-4px_8px_rgba(255,255,255,0.8)] dark:shadow-[4px_4px_8px_rgba(0,0,0,0.2),-4px_-4px_8px_rgba(255,255,255,0.05)] p-4 border border-gray-200/50 dark:border-gray-700/50"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                        {course.code}
                      </span>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 mt-1">
                        {course.title}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{new Date(course.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </motion.div>
    </div>
  )
}
