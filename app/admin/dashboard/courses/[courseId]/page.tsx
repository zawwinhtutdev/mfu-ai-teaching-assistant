"use client"

import { useParams } from "next/navigation"
import { AdminCourseDetail } from "@/components/admin/admin-course-detail"

export default function AdminCoursePage() {
  const params = useParams()
  const courseId = typeof params?.courseId === "string" ? params.courseId : ""

  if (!courseId) {
    return <p className="text-sm text-muted-foreground">Invalid course.</p>
  }

  return <AdminCourseDetail courseId={courseId} />
}