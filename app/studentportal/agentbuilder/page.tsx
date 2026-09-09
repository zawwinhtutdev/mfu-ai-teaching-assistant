"use client"

import { motion } from "framer-motion"
import { 
  Bot, 
  Sparkles, 
  MessageSquare, 
  Zap, 
  BookOpen,
  ArrowRight
} from "lucide-react"
import Link from "next/link"

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
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

const features = [
  {
    icon: MessageSquare,
    title: "Course AI Chat",
    description: "Already available! Ask questions about your course materials using the AI chatbot in each course.",
    link: "/studentportal/mycourses",
    linkText: "Go to My Courses",
    available: true
  },
  {
    icon: Sparkles,
    title: "Custom Study Agent",
    description: "Create personalized AI study agents tuned to your learning style and goals.",
    available: false
  },
  {
    icon: Zap,
    title: "Quick Actions Agent",
    description: "Build agents that automate study tasks like summarizing notes or generating practice questions.",
    available: false
  },
  {
    icon: BookOpen,
    title: "Research Assistant",
    description: "Configure an AI agent to help with research, literature reviews, and citation finding.",
    available: false
  },
]

export default function StudentAgentBuilderPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="container mx-auto px-4 py-6 lg:py-8 max-w-4xl"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg">
              <Bot className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-gray-100">
              Agent Builder
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400 ml-[52px]">
            Create and customize AI agents to enhance your learning experience.
          </p>
        </motion.div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <motion.div key={feature.title} variants={itemVariants}>
                <div className={`rounded-2xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 shadow-[8px_8px_16px_rgba(0,0,0,0.08),-8px_-8px_16px_rgba(255,255,255,0.9)] dark:shadow-[8px_8px_16px_rgba(0,0,0,0.3),-8px_-8px_16px_rgba(255,255,255,0.05)] p-5 h-full border border-gray-200/50 dark:border-gray-700/50 ${!feature.available ? 'opacity-60' : ''}`}>
                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-xl ${feature.available ? 'bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30' : 'bg-gray-100 dark:bg-gray-700'}`}>
                      <Icon className={`h-5 w-5 ${feature.available ? 'text-violet-600 dark:text-violet-400' : 'text-gray-400'}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">{feature.title}</h3>
                        {!feature.available && (
                          <span className="text-[10px] font-medium bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full">
                            Coming Soon
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        {feature.description}
                      </p>
                      {feature.available && feature.link && (
                        <Link
                          href={feature.link}
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
                        >
                          {feature.linkText}
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </motion.div>
    </div>
  )
}
