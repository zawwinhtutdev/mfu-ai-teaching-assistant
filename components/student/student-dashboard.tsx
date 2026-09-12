"use client"

import { motion } from "framer-motion"
import type { Course } from "@/lib/types"
import { CourseCard } from "./course-card"
import type { CourseEnrollmentFeedback } from "@/lib/types"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface StudentDashboardProps {
  courses: Course[]
  enrollmentFeedback?: CourseEnrollmentFeedback | null
}

export function StudentDashboard({ courses, enrollmentFeedback = null }: StudentDashboardProps) {
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
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.3
      }
    }
  }

  // Mock instructor data - in real app, this would come from the database
  const getInstructorName = (course: Course) => {
    // You can map course IDs to instructor names or fetch from API
    return "Instructor"
  }

  return (
    <div className="container mx-auto px-6 py-8">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        {enrollmentFeedback && (
          <Alert
            variant={enrollmentFeedback.status === "error" ? "destructive" : "default"}
            className="mb-6"
          >
            <AlertTitle>{enrollmentFeedback.status === "error" ? "Enrollment failed" : "Enrollment updated"}</AlertTitle>
            <AlertDescription>{enrollmentFeedback.message}</AlertDescription>
          </Alert>
        )}

        {/* Removed "My Courses 5 courses" chip per requirements */}

        {/* Course Grid */}
        {courses.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-block px-8 py-6 rounded-2xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 shadow-[8px_8px_16px_rgba(0,0,0,0.1),-8px_-8px_16px_rgba(255,255,255,0.8)] dark:shadow-[8px_8px_16px_rgba(0,0,0,0.3),-8px_-8px_16px_rgba(255,255,255,0.05)]">
              <p className="text-gray-600 dark:text-gray-400 mb-6 font-medium">
                No courses enrolled yet
              </p>
              {/* Removed Browse Courses entry point per requirements */}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {courses.map((course, index) => (
              <motion.div
                key={course.id}
                variants={itemVariants}
              >
                <CourseCard
                  course={course}
                  instructorName={getInstructorName(course)}
                  section={`Section ${(index % 3) + 1}`}
                />
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  )
}
