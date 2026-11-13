"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { 
  MessageSquare, 
  ArrowUpDown,
  Clock
} from "lucide-react"
import Link from "next/link"
import type { Profile, Course } from "@/lib/types"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from "recharts"

interface AnalyticsDashboardProps {
  profile: Profile
  courses: Course[]
  queries: any[]
}

type AnalyticsQuery = {
  student_id: string
  course_id: string
  created_at: string
  query?: string
  query_text?: string
  /** True when the assistant refused for lack of material coverage. */
  was_refused?: boolean
}

type TopStudent = {
  studentId: string
  queryCount: number
  lastActivity: Date
}

export function AnalyticsDashboard({ profile, courses, queries }: AnalyticsDashboardProps) {
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null)

  // Calculate overall statistics - limit queries processing for performance
  const stats = useMemo(() => {
    // Limit queries to max 1000 for better performance
    const limitedQueries = queries.slice(0, 1000) as AnalyticsQuery[]
    const totalQueries = queries.length
    const totalCourses = courses.length
    const totalStudents = new Set(limitedQueries.map(q => q.student_id)).size
    
    // Calculate average queries per student
    const avgQueriesPerStudent = totalStudents > 0 ? (totalQueries / totalStudents).toFixed(1) : "0"
    
    // Calculate queries per course with more details
    const queriesPerCourse = courses.map(course => {
      const courseQueries = limitedQueries.filter(q => q.course_id === course.id)
      const enrolledStudents = course.enrolled_students ?? 0
      return {
        courseId: course.id,
        courseTitle: course.title,
        courseCode: course.code,
        queryCount: courseQueries.length,
        enrolledStudents,
        engagementRate: enrolledStudents > 0 
          ? ((courseQueries.length / enrolledStudents) * 100).toFixed(1)
          : "0"
      }
    }).sort((a, b) => b.queryCount - a.queryCount)
    
    // Get most common questions (top 10) - using limited queries
    const questionCounts = limitedQueries.reduce((acc, query) => {
      const question = query.query || query.query_text || ""
      const normalized = question.toLowerCase().trim()
      if (normalized) {
        acc[normalized] = (acc[normalized] || 0) + 1
      }
      return acc
    }, {} as Record<string, number>)
    
    const topQuestions = (Object.entries(questionCounts) as Array<[string, number]>)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([question, count]) => ({ question, count }))
    
    // Calculate query trends (last 7 days) - using limited queries
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    
    const recentQueries = limitedQueries.filter(q => {
      const queryDate = new Date(q.created_at)
      return queryDate >= sevenDaysAgo
    })
    
    // Generate daily query data for chart
    const dailyData = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const dayQueries = limitedQueries.filter(q => {
        const queryDate = new Date(q.created_at)
        return queryDate.toDateString() === date.toDateString()
      }).length
      dailyData.push({ date: dateStr, queries: dayQueries })
    }
    
    // Calculate queries by hour (for peak hours analysis)
    const hourlyData = Array.from({ length: 24 }, (_, hour) => {
      const hourQueries = limitedQueries.filter(q => {
        const queryDate = new Date(q.created_at)
        return queryDate.getHours() === hour
      }).length
      return { hour: `${hour}:00`, queries: hourQueries }
    })
    
    // Get student activity data
    const studentActivity = limitedQueries.reduce((acc, query) => {
      const studentId = query.student_id
      if (!acc[studentId]) {
        acc[studentId] = {
          studentId,
          queryCount: 0,
          lastActivity: new Date(query.created_at)
        }
      }
      acc[studentId].queryCount++
      const queryDate = new Date(query.created_at)
      if (queryDate > acc[studentId].lastActivity) {
        acc[studentId].lastActivity = queryDate
      }
      return acc
    }, {} as Record<string, TopStudent>)
    
    const topStudents: TopStudent[] = Object.values(studentActivity)
      .sort((a, b) => b.queryCount - a.queryCount)
      .slice(0, 10)

    // Unanswered questions are the most actionable signal a teacher gets: each
    // one is a topic a student asked about that the uploaded material did not
    // cover. Spec §2.2 calls these "common misunderstandings".
    const refusedQueries = limitedQueries.filter((q) => q.was_refused === true)
    const unansweredQuestions = Object.entries(
      refusedQueries.reduce((acc, query) => {
        const question = String(query.query_text || query.query || "").toLowerCase().trim()
        if (question) acc[question] = (acc[question] || 0) + 1
        return acc
      }, {} as Record<string, number>),
    )
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([question, count]) => ({ question, count }))

    return {
      totalQueries,
      totalCourses,
      totalStudents,
      avgQueriesPerStudent,
      queriesPerCourse,
      topQuestions,
      recentQueries: recentQueries.length,
      dailyData,
      hourlyData,
      topStudents,
      refusedCount: refusedQueries.length,
      unansweredQuestions,
    }
  }, [courses, queries])

  // Sort function for tables
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc'
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  const sortedCourses = useMemo(() => {
    if (!sortConfig) return stats.queriesPerCourse
    
    return [...stats.queriesPerCourse].sort((a, b) => {
      let aValue: any = a[sortConfig.key as keyof typeof a]
      let bValue: any = b[sortConfig.key as keyof typeof b]
      
      if (sortConfig.key === 'courseTitle' || sortConfig.key === 'courseCode') {
        aValue = String(aValue).toLowerCase()
        bValue = String(bValue).toLowerCase()
      }
      
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })
  }, [stats.queriesPerCourse, sortConfig])

  const sortedQuestions = useMemo(() => {
    if (!sortConfig || (sortConfig.key !== 'question' && sortConfig.key !== 'count')) {
      return stats.topQuestions
    }
    
    return [...stats.topQuestions].sort((a, b) => {
      if (sortConfig.key === 'question') {
        const aValue = a.question.toLowerCase()
        const bValue = b.question.toLowerCase()
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1
      } else if (sortConfig.key === 'count') {
        if (a.count < b.count) return sortConfig.direction === 'asc' ? -1 : 1
        if (a.count > b.count) return sortConfig.direction === 'asc' ? 1 : -1
      }
      return 0
    })
  }, [stats.topQuestions, sortConfig])

  const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444']

  return (
    <div className="container mx-auto flex-1 px-4 py-8 space-y-6">
      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Query Trends Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Query Trends</CardTitle>
            <CardDescription>Daily query volume over the last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={stats.dailyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="date" 
                  className="text-xs"
                  tick={{ fill: 'currentColor' }}
                />
                <YAxis 
                  className="text-xs"
                  tick={{ fill: 'currentColor' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="queries" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Query Distribution by Course */}
        <Card>
          <CardHeader>
            <CardTitle>Query Distribution</CardTitle>
            <CardDescription>Queries by course</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.queriesPerCourse.slice(0, 6)}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="courseCode" 
                  className="text-xs"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  tick={{ fill: 'currentColor' }}
                />
                <YAxis 
                  className="text-xs"
                  tick={{ fill: 'currentColor' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }}
                />
                <Bar dataKey="queryCount" radius={[4, 4, 0, 0]}>
                  {stats.queriesPerCourse.slice(0, 6).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tables Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Course Activity Table */}
        <Card>
          <CardHeader>
            <CardTitle>Course Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <button
                        onClick={() => handleSort('courseTitle')}
                        className="flex items-center gap-1 hover:text-foreground"
                      >
                        Course
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort('queryCount')}
                        className="flex items-center gap-1 hover:text-foreground"
                      >
                        Queries
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead>Students</TableHead>
                    <TableHead>Engagement</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedCourses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No course activity yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedCourses.map((course) => (
                      <TableRow key={course.courseId}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{course.courseTitle}</div>
                            <div className="text-sm text-muted-foreground">{course.courseCode}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold">{course.queryCount}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{course.enrolledStudents}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{course.engagementRate}%</div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/teacherportal/mycourses/${course.courseId}/analytics`}>
                              View
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Most Common Questions Table */}
        <Card>
          <CardHeader>
            <CardTitle>Most Common Questions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">#</TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort('question')}
                        className="flex items-center gap-1 hover:text-foreground"
                      >
                        Question
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button
                        onClick={() => handleSort('count')}
                        className="flex items-center gap-1 hover:text-foreground ml-auto"
                      >
                        Count
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedQuestions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        No questions yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedQuestions.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                        <TableCell>
                          <div className="max-w-md">
                            <p className="text-sm font-medium line-clamp-2">{item.question}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <MessageSquare className="h-3 w-3 text-muted-foreground" />
                            <span className="font-semibold">{item.count}</span>
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

        {/* Unanswered questions: each row is a topic the material did not cover,
            which is the most actionable gap a teacher can act on. */}
        <Card>
          <CardHeader>
            <CardTitle>Unanswered Questions</CardTitle>
            <CardDescription>
              {stats.refusedCount > 0
                ? `${stats.refusedCount} question${stats.refusedCount === 1 ? "" : "s"} could not be answered from the uploaded material. Adding these topics to your course documents would close the gap.`
                : "Every question so far was answered from your uploaded material."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats.unansweredQuestions.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No unanswered questions yet.
              </p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">#</TableHead>
                      <TableHead>Question</TableHead>
                      <TableHead className="text-right">Asked</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.unansweredQuestions.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                        <TableCell>
                          <p className="line-clamp-2 max-w-md text-sm">{item.question}</p>
                        </TableCell>
                        <TableCell className="text-right font-semibold">{item.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Student Activity Table */}
      <Card>
        <CardHeader>
          <CardTitle>Student Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rank</TableHead>
                  <TableHead>Student ID</TableHead>
                  <TableHead>Total Queries</TableHead>
                  <TableHead>Last Activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.topStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No student activity yet
                    </TableCell>
                  </TableRow>
                ) : (
                  stats.topStudents.map((student, index) => {
                    return (
                      <TableRow key={student.studentId}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {index < 3 && (
                              <span className="text-yellow-500">★</span>
                            )}
                            <span className="font-medium">#{index + 1}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{student.studentId}</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold">{student.queryCount}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {student.lastActivity.toLocaleDateString()}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

    </div>
  )
}
