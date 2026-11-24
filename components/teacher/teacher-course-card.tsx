"use client"

import Link from "next/link"
import { ArrowRight, BarChart3, Settings } from "lucide-react"
import type { Course } from "@/lib/types"

interface TeacherCourseCardProps {
  course: Course & { enrolled_students?: number }
}

/** Classum-style course row/card: quiet surface, squircle mark, meta line, pill actions. */
export function TeacherCourseCard({ course }: TeacherCourseCardProps) {
  const courseCode = course.code || "N/A"
  const courseTitle = course.title || "Untitled Course"
  const courseDescription = (course as any).description || ""
  const initial = courseTitle.trim().charAt(0).toUpperCase() || "C"
  const href = `/teacherportal/mycourses/${course.id}`

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
            href={href}
            style={{ color: "var(--p-fg)", fontSize: 15, fontWeight: 700, lineHeight: 1.35, letterSpacing: "-0.01em" }}
            className="line-clamp-2 hover:underline"
          >
            {courseTitle}
          </Link>
          <div style={{ marginTop: 2, fontSize: 12, color: "var(--p-tertiary)" }}>{courseCode}</div>
        </div>

        <Link
          href={href}
          className="mfp-pill"
          style={{ height: 32, padding: "0 12px", fontSize: 12, flex: "0 0 auto" }}
        >
          Open course
          <ArrowRight size={13} />
        </Link>
      </div>

      {courseDescription ? (
        <p
          style={{ marginTop: 12, fontSize: 13, lineHeight: 1.55, color: "var(--p-muted)" }}
          className="line-clamp-2"
        >
          {courseDescription}
        </p>
      ) : null}

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
