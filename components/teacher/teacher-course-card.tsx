"use client"

import Link from "next/link"
import { BarChart3, Users, Settings, MoreHorizontal } from "lucide-react"
import type { Course } from "@/lib/types"

interface TeacherCourseCardProps {
  course: Course & { enrolled_students?: number }
}

/** Classum-style course row/card: quiet surface, squircle mark, meta line, pill actions. */
export function TeacherCourseCard({ course }: TeacherCourseCardProps) {
  const courseCode = course.code || "N/A"
  const courseTitle = course.title || "Untitled Course"
  const courseDescription = (course as any).description || ""
  const enrolledStudents = (course as any).enrolled_students || 0
  const initial = courseTitle.trim().charAt(0).toUpperCase() || "C"

  return (
    <article className="mfp-card flex h-full flex-col p-5">
      <div className="flex items-start gap-3">
        <div
          style={{
            display: "grid",
            placeItems: "center",
            width: 40,
            height: 40,
            flex: "0 0 auto",
            borderRadius: 12,
            background: "var(--p-rail)",
            color: "var(--p-fg)",
            fontSize: 16,
            fontWeight: 700,
          }}
          aria-hidden
        >
          {initial}
        </div>

        <div className="min-w-0 flex-1">
          <Link
            href={`/teacherportal/mycourses/${course.id}`}
            style={{ color: "var(--p-fg)", fontSize: 15, fontWeight: 700, lineHeight: 1.35, letterSpacing: "-0.01em" }}
            className="line-clamp-2 hover:underline"
          >
            {courseTitle}
          </Link>
          <div style={{ marginTop: 2, fontSize: 12, color: "var(--p-tertiary)" }}>{courseCode}</div>
        </div>

        <button type="button" className="mfp-icon-btn" aria-label="Course actions" style={{ width: 32, height: 32 }}>
          <MoreHorizontal size={16} />
        </button>
      </div>

      {courseDescription ? (
        <p
          style={{ marginTop: 12, fontSize: 13, lineHeight: 1.55, color: "var(--p-muted)" }}
          className="line-clamp-2"
        >
          {courseDescription}
        </p>
      ) : null}

      <div className="mt-3 flex items-center gap-1.5" style={{ fontSize: 12.5, color: "var(--p-muted)" }}>
        <Users size={15} style={{ color: "var(--p-tertiary)" }} />
        {enrolledStudents} {enrolledStudents === 1 ? "student" : "students"}
      </div>

      <div
        className="mt-4 flex items-center gap-2 pt-4"
        style={{ borderTop: "1px solid var(--p-line)" }}
      >
        <Link
          href={`/teacherportal/mycourses/${course.id}/analytics`}
          className="mfp-nav-item"
          style={{ height: 34, padding: "0 12px", fontSize: 12.5, fontWeight: 600, gap: 6 }}
        >
          <BarChart3 size={15} />
          Analytics
        </Link>
        <Link
          href={`/teacherportal/mycourses/${course.id}`}
          className="mfp-nav-item"
          style={{ height: 34, padding: "0 12px", fontSize: 12.5, fontWeight: 600, gap: 6 }}
        >
          <Settings size={15} />
          Manage
        </Link>
      </div>
    </article>
  )
}
