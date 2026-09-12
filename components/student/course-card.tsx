"use client"

import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { BookOpen, Users, FileText, BarChart3, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ButtonGroup, ButtonGroupSeparator } from "@/components/ui/button-group"
import { 
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import type { Course } from "@/lib/types"
import { slugify } from "@/lib/utils"

interface CourseCardProps {
  course: Course & { enrolled_students?: number }
  instructorName?: string
  section?: string
}

export function CourseCard({ 
  course, 
  instructorName = "Instructor",
  section = "Section 1"
}: CourseCardProps) {
  const courseCode = course.code || "N/A"
  const courseTitle = course.title || "Untitled Course"
  const courseDescription = (course as any).description || ""
  const enrolledStudents = (course as any).enrolled_students || 0

  return (
    <Card className="relative bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-[4px_4px_8px_rgba(0,0,0,0.06),-4px_-4px_8px_rgba(255,255,255,0.4)] dark:shadow-[4px_4px_8px_rgba(0,0,0,0.2),-4px_-4px_8px_rgba(255,255,255,0.03)] hover:shadow-[6px_6px_12px_rgba(0,0,0,0.08),-6px_-6px_12px_rgba(255,255,255,0.5)] dark:hover:shadow-[6px_6px_12px_rgba(0,0,0,0.25),-6px_-6px_12px_rgba(255,255,255,0.04)] transition-all duration-300 h-full flex flex-col">
      {/* Top Right Book Icon */}
      <div className="absolute top-4 right-4 z-10">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-200 to-blue-300 dark:from-blue-700 dark:to-blue-800 rounded-xl shadow-[4px_4px_8px_rgba(0,0,0,0.15),-2px_-2px_4px_rgba(255,255,255,0.5)] dark:shadow-[4px_4px_8px_rgba(0,0,0,0.3),-2px_-2px_4px_rgba(255,255,255,0.05)] flex items-center justify-center">
          <BookOpen className="h-5 w-5 text-blue-700 dark:text-blue-200" />
        </div>
      </div>

      <CardContent className="p-6 flex flex-col flex-1">
        {/* Clickable Course Info Area */}
        <Link 
          href={`/studentportal/mycourses/${slugify(course.title)}`}
          className="flex-1 flex flex-col mb-4"
        >
          {/* Course Title */}
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2 pr-12 line-clamp-2">
            {courseTitle}
          </h3>

          {/* Course Code */}
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-4">
            {courseCode}
          </p>

          {/* Course Description */}
          {courseDescription && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-3 flex-1 leading-relaxed">
              {courseDescription}
            </p>
          )}

          {/* Student Count */}
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <div className="p-1.5 bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-lg shadow-[inset_2px_2px_4px_rgba(0,0,0,0.05),inset_-2px_-2px_4px_rgba(255,255,255,0.5)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.2),inset_-2px_-2px_4px_rgba(255,255,255,0.05)]">
              <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            <span>{enrolledStudents} {enrolledStudents === 1 ? "student" : "students"}</span>
          </div>
        </Link>

        {/* Actions: primary + dropdown */}
        <div className="pt-5 border-t border-gray-200/50 dark:border-gray-700/50">
          <ButtonGroup className="w-full">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 rounded-xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 shadow-[4px_4px_8px_rgba(0,0,0,0.1),-4px_-4px_8px_rgba(255,255,255,0.8)] dark:shadow-[4px_4px_8px_rgba(0,0,0,0.3),-4px_-4px_8px_rgba(255,255,255,0.05)] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.1),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)] border-0 text-gray-700 dark:text-gray-300 transition-all"
            asChild
          >
            <Link href={`/studentportal/mycourses/${slugify(course.title)}`}>
              <FileText className="h-4 w-4 mr-2" />
                Open Course
            </Link>
          </Button>
            <ButtonGroupSeparator />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
                  className="rounded-xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 shadow-[4px_4px_8px_rgba(0,0,0,0.1),-4px_-4px_8px_rgba(255,255,255,0.8)] dark:shadow-[4px_4px_8px_rgba(0,0,0,0.3),-4px_-4px_8px_rgba(255,255,255,0.05)] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.1),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)] border-0 text-gray-700 dark:text-gray-300 transition-all"
                  aria-label="More actions"
          >
                  <ChevronDown className="h-4 w-4" />
          </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href={`/studentportal/mycourses/${slugify(course.title)}`}>
                    <FileText className="h-4 w-4 mr-2" /> View Course
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/studentportal/mycourses/${slugify(course.title)}?tab=progress`}>
                    <BarChart3 className="h-4 w-4 mr-2" /> Progress
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </ButtonGroup>
        </div>
      </CardContent>
    </Card>
  )
}

