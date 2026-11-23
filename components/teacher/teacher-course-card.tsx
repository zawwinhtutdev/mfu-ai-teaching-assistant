"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { BarChart3, Check, Copy, MoreHorizontal, Settings } from "lucide-react"
import type { Course } from "@/lib/types"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

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

  /**
   * The kebab used to be a bare <button> with no menu behind it, so clicking it
   * did nothing. Mirror the student card's actions so both portals behave the
   * same way for the same affordance.
   */
  const [copied, setCopied] = useState(false)
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current)
    }
  }, [])

  const copyCourseCode = async () => {
    try {
      await navigator.clipboard.writeText(courseCode)
      setCopied(true)
      if (copiedTimer.current) clearTimeout(copiedTimer.current)
      copiedTimer.current = setTimeout(() => setCopied(false), 1600)
    } catch {
      // Clipboard access can be denied (insecure context or permission).
    }
  }

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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="mfp-icon-btn"
              aria-label={`Actions for ${courseTitle}`}
              style={{ width: 32, height: 32 }}
            >
              <MoreHorizontal size={16} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="truncate text-xs font-semibold">{courseCode}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={href}>
                <Settings className="mr-2 h-4 w-4" />
                Manage course
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`${href}/analytics`}>
                <BarChart3 className="mr-2 h-4 w-4" />
                Analytics
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              // Keep the menu open so the inline "Copied" confirmation is visible.
              onSelect={(event) => {
                event.preventDefault()
                void copyCourseCode()
              }}
            >
              {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              {copied ? "Copied" : "Copy course code"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
