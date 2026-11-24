"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import type { Course } from "@/lib/types"
import { slugify } from "@/lib/utils"

interface CourseCardProps {
  course: Course
  instructorName?: string
  section?: string
}

/** Classum-style course card: quiet surface, squircle mark, meta line, single pill action. */
export function CourseCard({ course, instructorName = "Instructor", section = "Section 1" }: CourseCardProps) {
  const courseCode = course.code || "N/A"
  const courseTitle = course.title || "Untitled Course"
  const courseDescription = (course as any).description || ""
  const initial = courseTitle.trim().charAt(0).toUpperCase() || "C"
  const href = `/studentportal/mycourses/${slugify(course.title)}`

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
          <div style={{ marginTop: 2, fontSize: 12, color: "var(--p-tertiary)" }}>
            {courseCode} · {instructorName} · {section}
          </div>
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
        <p style={{ marginTop: 12, fontSize: 13, lineHeight: 1.55, color: "var(--p-muted)" }} className="line-clamp-2">
          {courseDescription}
        </p>
      ) : null}

    </article>
  )
}
