"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Search, BookOpen, Users, BarChart3, Settings } from "lucide-react"
import Link from "next/link"
import type { Profile, Course } from "@/lib/types"
import { CreateCourseDialog } from "./create-course-dialog"

interface CoursesListPageProps {
  profile: Profile
  courses: Course[]
}

export function CoursesListPage({ profile, courses }: CoursesListPageProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  const filteredCourses = courses.filter((course) =>
    course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    course.code.toLowerCase().includes(searchQuery.toLowerCase())
  )

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

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="container mx-auto flex-1 px-4 py-8"
    >
        <div className="mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search courses by name or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {filteredCourses.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <BookOpen className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-semibold">
                {searchQuery ? "No courses found" : "No courses yet"}
              </h3>
              <p className="mb-4 text-sm text-muted-foreground">
                {searchQuery 
                  ? "Try adjusting your search query"
                  : "Create your first course to get started"}
              </p>
              {!searchQuery && (
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Course
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredCourses.map((course) => (
              <motion.div
                key={course.id}
                variants={itemVariants}
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="relative overflow-hidden cursor-pointer transition-all hover:shadow-lg h-full flex flex-col">
                  <Link href={`/teacherportal/mycourses/${course.id}`} className="flex-1 flex flex-col">
                    <CardHeader className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <CardTitle className="text-lg line-clamp-2">{course.title}</CardTitle>
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/20 flex-shrink-0 ml-2">
                          <BookOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                      </div>
                      <CardDescription className="font-semibold text-base">{course.code}</CardDescription>
                      {course.description && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          {course.description}
                        </p>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          <span>{(course as any).enrolled_students || 0} students</span>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={(e) => {
                            e.preventDefault()
                            window.location.href = `/teacherportal/mycourses/${course.id}/analytics`
                          }}
                        >
                          <BarChart3 className="mr-2 h-4 w-4" />
                          Analytics
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={(e) => {
                            e.preventDefault()
                            window.location.href = `/teacherportal/mycourses/${course.id}?tab=course-settings`
                          }}
                        >
                          <Settings className="mr-2 h-4 w-4" />
                          Manage
                        </Button>
                      </div>
                    </CardContent>
                  </Link>
                </Card>
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
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 z-50 p-0"
      >
        <Plus className="h-6 w-6" />
      </Button>
    </motion.div>
  )
}

