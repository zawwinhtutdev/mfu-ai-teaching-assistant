"use client"

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { Users, ArrowUpDown, MessageSquare, BellRing, FileQuestion } from "lucide-react"
import type { Course } from "@/lib/types"

interface AnalyticsPageProps {
  course: Course
  queries: any[]
  enrollments: any[]
  totalQuizzes?: number
  totalAssignments?: number
  totalReminders?: number
}

export function AnalyticsPage({
  course,
  queries,
  enrollments,
  totalQuizzes = 0,
  totalAssignments = 0,
  totalReminders = 0,
}: AnalyticsPageProps) {

  // Build student data with quiz progress and assignment progress
  const studentData = useMemo(() => {
    return enrollments.map((enrollment) => {
      const studentId = enrollment.student_id || enrollment.profiles?.id
      
      // Calculate quiz progress (mock: stable based on student ID hash)
      // In production, this would come from quiz_submissions table
      const hash = studentId.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0)
      const completedQuizzes = totalQuizzes > 0 ? hash % (totalQuizzes + 1) : 0
      const quizProgress = totalQuizzes > 0 ? (completedQuizzes / totalQuizzes) * 100 : 0

      // Calculate assignment submission progress (mock: stable based on student ID hash)
      // In production, this would come from assignment_submissions table
      const assignmentHash = (hash * 7) % (totalAssignments + 1) // Different hash for variety
      const submittedAssignments = totalAssignments > 0 ? assignmentHash : 0
      const assignmentProgress = totalAssignments > 0 ? (submittedAssignments / totalAssignments) * 100 : 0

      return {
        studentId,
        name: enrollment.profiles?.full_name || "Unknown",
        email: enrollment.profiles?.email || "",
        completedQuizzes,
        totalQuizzes,
        quizProgress: Math.round(quizProgress),
        submittedAssignments,
        totalAssignments,
        assignmentProgress: Math.round(assignmentProgress),
      }
    })
  }, [enrollments, totalQuizzes, totalAssignments])

  // Sort students by name by default
  const sortedStudents = useMemo(() => {
    return [...studentData].sort((a, b) => {
      return a.name.localeCompare(b.name)
    })
  }, [studentData])

  return (
    <div className="container mx-auto flex-1 px-4 py-8">
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Students</p>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-2xl font-semibold">{enrollments.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Student Queries</p>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-2xl font-semibold">{queries.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Quizzes</p>
              <FileQuestion className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-2xl font-semibold">{totalQuizzes}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Reminders</p>
              <BellRing className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-2xl font-semibold">{totalReminders}</p>
          </CardContent>
        </Card>
      </div>

      {/* Student List Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Student List
          </CardTitle>
          <CardDescription>
            {sortedStudents.length} student{sortedStudents.length !== 1 ? 's' : ''} enrolled in this course
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">#</TableHead>
                  <TableHead>
                    <button className="flex items-center gap-1 hover:text-foreground">
                      Student Name
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button className="flex items-center gap-1 hover:text-foreground">
                      Email
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead className="w-[300px]">Quiz Progress</TableHead>
                  <TableHead className="w-[300px]">Assignment Progress Submission</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No students enrolled in this course yet
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedStudents.map((student, index) => (
                    <TableRow key={student.studentId}>
                      <TableCell className="text-muted-foreground">
                        {index + 1}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{student.name}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">{student.email}</div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Progress value={student.quizProgress} className="h-2" />
                          <div className="text-xs text-muted-foreground">
                            {student.completedQuizzes} of {student.totalQuizzes} quizzes
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Progress value={student.assignmentProgress} className="h-2" />
                          <div className="text-xs text-muted-foreground">
                            {student.submittedAssignments} of {student.totalAssignments} assignments
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
