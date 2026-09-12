"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { 
  MessageSquare, 
  Brain, 
  FileText, 
  Calendar,
  BookOpen,
  ArrowRight,
  Sparkles
} from "lucide-react"
import { slugify } from "@/lib/utils"
import type { Course } from "@/lib/types"

interface AiStudyToolsHubProps {
  courses: Course[]
}

const tools = [
  { 
    id: "chat", 
    label: "AI Chat", 
    icon: MessageSquare, 
    description: "Ask questions about course content",
    color: "from-blue-500 to-blue-600",
    bgLight: "from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20",
    tab: "ai-assistant"
  },
  { 
    id: "flashcards", 
    label: "Flashcards", 
    icon: Brain, 
    description: "Review key concepts with AI-generated cards",
    color: "from-purple-500 to-purple-600",
    bgLight: "from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20",
    tab: "ai-assistant"
  },
  { 
    id: "quizzes", 
    label: "Quizzes", 
    icon: FileText, 
    description: "Test your knowledge with AI quizzes",
    color: "from-green-500 to-green-600",
    bgLight: "from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20",
    tab: "ai-assistant"
  },
  { 
    id: "planner", 
    label: "Study Planner", 
    icon: Calendar, 
    description: "Plan your study schedule with AI",
    color: "from-amber-500 to-amber-600",
    bgLight: "from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20",
    tab: "ai-assistant"
  },
]

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

export function AiStudyToolsHub({ courses }: AiStudyToolsHubProps) {
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
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-gray-100">
              AI Study Tools
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400 ml-[52px]">
            Select a course to access AI-powered study tools — chat, flashcards, quizzes, and study planner.
          </p>
        </motion.div>

        {/* Tool Overview Cards */}
        <motion.div variants={itemVariants} className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {tools.map((tool) => {
            const Icon = tool.icon
            return (
              <div
                key={tool.id}
                className="rounded-xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 shadow-[4px_4px_8px_rgba(0,0,0,0.06),-4px_-4px_8px_rgba(255,255,255,0.8)] dark:shadow-[4px_4px_8px_rgba(0,0,0,0.2),-4px_-4px_8px_rgba(255,255,255,0.05)] p-4 text-center"
              >
                <div className={`inline-flex p-2.5 rounded-xl bg-gradient-to-br ${tool.bgLight} mb-2`}>
                  <Icon className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                </div>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{tool.label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 hidden sm:block">{tool.description}</p>
              </div>
            )
          })}
        </motion.div>

        {/* Course List */}
        <motion.div variants={itemVariants}>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Your Courses
          </h2>

          {courses.length === 0 ? (
            <div className="rounded-2xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 shadow-[8px_8px_16px_rgba(0,0,0,0.08),-8px_-8px_16px_rgba(255,255,255,0.9)] dark:shadow-[8px_8px_16px_rgba(0,0,0,0.3),-8px_-8px_16px_rgba(255,255,255,0.05)] p-12 text-center">
              <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
                No courses enrolled
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Enroll in courses to access AI study tools.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {courses.map((course, index) => {
                const courseSlug = slugify(course.title)
                const coursePath = `/studentportal/mycourses/${courseSlug}`

                return (
                  <motion.div
                    key={course.id}
                    variants={itemVariants}
                    custom={index}
                  >
                    <Link href={coursePath}>
                      <div className="group rounded-xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 shadow-[4px_4px_8px_rgba(0,0,0,0.06),-4px_-4px_8px_rgba(255,255,255,0.8)] dark:shadow-[4px_4px_8px_rgba(0,0,0,0.2),-4px_-4px_8px_rgba(255,255,255,0.05)] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.06),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.2),inset_-2px_-2px_4px_rgba(255,255,255,0.05)] p-4 lg:p-5 transition-all border border-gray-200/50 dark:border-gray-700/50">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                                {course.code}
                              </span>
                            </div>
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                              {course.title}
                            </h3>
                            <div className="flex items-center gap-3 mt-2">
                              {tools.map((tool) => {
                                const ToolIcon = tool.icon
                                return (
                                  <div
                                    key={tool.id}
                                    className={`flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400`}
                                    title={tool.label}
                                  >
                                    <ToolIcon className="h-3.5 w-3.5" />
                                    <span className="hidden sm:inline">{tool.label}</span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                          <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors flex-shrink-0 ml-4" />
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                )
              })}
            </div>
          )}
        </motion.div>
      </motion.div>
    </div>
  )
}
