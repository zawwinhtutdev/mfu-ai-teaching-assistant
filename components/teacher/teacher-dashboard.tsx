"use client"

import { motion, LazyMotion, domAnimation } from "framer-motion"
import Link from "next/link"
import type { Profile, Course } from "@/lib/types"
import { TeacherCourseCard } from "./teacher-course-card"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { CreateCourseDialog } from "./create-course-dialog"
import { useState } from "react"

interface TeacherDashboardProps {
  profile: Profile
  courses: Course[]
  totalStudents?: number
  totalQueries?: number
}

export function TeacherDashboard({ profile, courses }: TeacherDashboardProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  // Reduced animation durations for better performance
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.02,
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

  return (
    <LazyMotion features={domAnimation}>
      <motion.div 
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="container mx-auto flex-1 px-4 py-8"
      >
      {/* Course Grid */}
      {courses.length === 0 ? (
        <div className="text-center py-12">
          <div className="inline-block px-8 py-6 rounded-2xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 shadow-[8px_8px_16px_rgba(0,0,0,0.1),-8px_-8px_16px_rgba(255,255,255,0.8)] dark:shadow-[8px_8px_16px_rgba(0,0,0,0.3),-4px_-4px_8px_rgba(255,255,255,0.05)]">
            <p className="text-gray-600 dark:text-gray-400 mb-6 font-medium">
              No courses created yet
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Course
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {courses.map((course) => (
            <motion.div
              key={course.id}
              variants={itemVariants}
            >
              <TeacherCourseCard course={course} />
            </motion.div>
          ))}
        </div>
      )}

      <CreateCourseDialog 
        open={showCreateDialog} 
        onOpenChange={setShowCreateDialog}
        teacherId={profile.id}
      />
      
      {/* Floating Action Button - Bottom Right */}
      <Button 
        onClick={() => setShowCreateDialog(true)}
        className="mfp-pill fixed bottom-6 right-6 z-50 h-12 px-5 shadow-[0_10px_24px_-8px_rgba(0,0,0,0.45)]"
      >
        <Plus size={18} />
        <span style={{ marginLeft: 2 }}>New course</span>
      </Button>
      </motion.div>
    </LazyMotion>
  )
}
