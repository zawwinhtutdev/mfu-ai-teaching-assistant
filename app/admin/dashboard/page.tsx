"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CourseDialog, type CourseFormValues } from "@/components/admin/course-dialog"
import { CourseInfoDialog } from "@/components/admin/course-info-dialog"
import { CourseScheduleDialog } from "@/components/admin/course-schedule-dialog"
import { EnrollStudentsDialog } from "@/components/admin/enroll-students-dialog"

const LINE = "#eff1f6"
const TEXT = "#232334"
const MUTED = "#666b80"
const TERT = "#8d92a6"

/**
 * Table geometry, shared by the header and every row so they cannot drift apart.
 *
 * The selection column was removed: it toggled a checkbox that no action
 * consumed, so it was purely decorative. The remaining fixed columns total
 * 566px, so the grid needs a floor or the `1.6fr` course-name column collapses
 * to nothing and the name renders with zero width.
 */
const COURSE_GRID = "minmax(190px, 1.5fr) 96px minmax(120px, 1fr) 80px 96px 112px 250px"
const COURSE_TABLE_MIN_WIDTH = 1000

/** Shape returned by GET /api/admin/courses. */
interface ApiCourse {
  id: string
  code: string
  title: string
  description: string | null
  semester: string | null
  academic_year: string | null
  school: string | null
  credit_total: number | null
  credit_lecture: number | null
  credit_lab: number | null
  credit_self_study: number | null
  grading_type: string | null
  further_information: string | null
  teacher_id: string | null
  teacher_name: string | null
  teacher_email: string | null
  /** The full teaching team; `teacher_*` above is the legacy primary owner. */
  teachers?: Array<{ id: string; full_name: string | null; email: string }>
  enrolled_students: number
  documents: number
  documents_ready: number
  sections: number
  created_at: string
}

/** Map an API row to the dialog's string-based form values. */
function toFormValues(course: ApiCourse): CourseFormValues {
  return {
    id: course.id,
    code: course.code,
    title: course.title,
    description: course.description ?? "",
    semester: course.semester ?? "",
    academicYear: course.academic_year ?? "",
    school: course.school ?? "",
    furtherInformation: course.further_information ?? "",
    teacherId: course.teacher_id,
    // Prefer the full team; fall back to the legacy single owner so a course
    // created before multiple teachers existed still opens with its teacher.
    teacherEmails:
      course.teachers && course.teachers.length > 0
        ? course.teachers.map((teacher) => teacher.email)
        : course.teacher_email
          ? [course.teacher_email]
          : [],
  }
}

/**
 * Format an ISO timestamp as DD/MM/YYYY.
 *
 * Built from UTC parts rather than `toLocaleDateString`: the server and the
 * browser can resolve different default locales/timezones, which produced
 * different strings and a React hydration mismatch on this page.
 */
function fmtDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  const day = String(date.getUTCDate()).padStart(2, "0")
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  return `${day}/${month}/${date.getUTCFullYear()}`
}

function SkeletonTile() {
  return <div style={{ width: 76, height: 38, borderRadius: 10, background: "#eef0f6" }} />
}

export default function ManageCoursesPage() {
  const [courses, setCourses] = useState<ApiCourse[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<"All" | "Active">("All")
  const [statusOpen, setStatusOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editingCourse, setEditingCourse] = useState<CourseFormValues | null>(null)
  const [enrollCourse, setEnrollCourse] = useState<{ id: string; label: string } | null>(null)
  const [infoCourseId, setInfoCourseId] = useState<string | null>(null)
  const [scheduleCourse, setScheduleCourse] = useState<{ id: string; label: string } | null>(null)
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/courses", { cache: "no-store" })
      const data = await res.json()
      if (res.ok) setCourses(data?.courses || [])
    } catch {
      /* keep previous rows */
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return courses.filter((c) => {
      // Every course currently exists (there is no archived/disabled state), so
      // "Active" matches everything. The filter is wired to the real field
      // rather than left as a control that changes nothing.
      if (status === "Active" && (c as any).status && (c as any).status !== "active") {
        return false
      }
      const hay = `${c.code} ${c.title} ${c.teacher_name ?? ""}`.toLowerCase()
      return !q || hay.includes(q)
    })
  }, [courses, query, status])

  return (
    <div>
      {/* page head */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: TEXT, margin: 0 }}>Manage courses</h1>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ position: "relative", width: 240 }}>
            {/*
              Drawn as an SVG rather than the "⌕" character. That glyph is a
              symbol-font codepoint whose apparent size depends on which font the
              browser substitutes for it, which is why it rendered as a speck
              next to the placeholder text. An SVG has an explicit box, so it
              matches the text at any zoom or platform.
            */}
            <svg
              aria-hidden
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              style={{
                position: "absolute",
                left: 13,
                top: "50%",
                transform: "translateY(-50%)",
                color: TERT,
                pointerEvents: "none",
              }}
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              aria-label="Search courses"
              style={{
                width: "100%",
                height: 40,
                padding: "0 14px 0 36px",
                borderRadius: 999,
                border: `1px solid ${LINE}`,
                background: "#fff",
                fontSize: 14,
                color: TEXT,
                outline: "none",
              }}
            />
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              height: 40,
              padding: "0 16px",
              borderRadius: 999,
              border: "none",
              background: TEXT,
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              whiteSpace: "nowrap",
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
            New course
          </button>
        </div>
      </div>

      <div style={{ borderTop: `2px solid ${TEXT}`, paddingTop: 14 }}>
        {/* filter row */}
        <div style={{ position: "relative", marginBottom: 12 }}>
          <button
            type="button"
            onClick={() => setStatusOpen((v) => !v)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              height: 34,
              padding: "0 12px",
              borderRadius: 10,
              border: `1px solid ${LINE}`,
              background: "#f7f8fc",
              color: MUTED,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            {status} <span style={{ fontSize: 10, color: TERT }}>▾</span>
          </button>
          {statusOpen && (
            <div
              style={{
                position: "absolute",
                top: 40,
                left: 0,
                zIndex: 20,
                minWidth: 150,
                padding: 6,
                borderRadius: 12,
                border: `1px solid ${LINE}`,
                background: "#fff",
                boxShadow: "0 8px 24px rgba(16,24,40,.12)",
              }}
            >
              {(["All", "Active"] as const).map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    setStatus(name)
                    setStatusOpen(false)
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 10px",
                    border: 0,
                    borderRadius: 8,
                    background: name === status ? "#f4f6fa" : "transparent",
                    color: TEXT,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* table */}
        <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, background: "#fff", overflowX: "auto" }}>
          {/* The grid must be at least as wide as its fixed columns or the
              `1fr` course-name column collapses to zero and the name becomes
              invisible. minWidth guarantees the columns fit; the parent scrolls
              horizontally on narrow viewports instead of crushing the name. */}
          <div style={{ minWidth: COURSE_TABLE_MIN_WIDTH }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: COURSE_GRID,
              alignItems: "center",
              height: 44,
              padding: "0 10px",
              background: "#fafbfe",
              borderBottom: `1px solid ${LINE}`,
              fontSize: 12,
              color: TERT,
              fontWeight: 600,
            }}
          >
            <span>Course name ⇅</span>
            <span>Status ⇅</span>
            <span>Teacher ⇅</span>
            <span>Students ⇅</span>
            <span>Documents ⇅</span>
            <span>Created ⇅</span>
            <span />
          </div>

          {loading ? (
            <div style={{ padding: 24 }}>
              <div style={{ height: 44, borderRadius: 8, background: "#f4f6fa", marginBottom: 8 }} />
              <div style={{ height: 44, borderRadius: 8, background: "#f4f6fa" }} />
            </div>
          ) : rows.length === 0 ? (
            <div style={{ padding: "56px 16px", textAlign: "center" }}>
              <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 14 }}>
                <SkeletonTile />
                <SkeletonTile />
              </div>
              <p style={{ margin: 0, color: TERT, fontSize: 14, lineHeight: 1.5 }}>
                Let&apos;s create a course
                <br />
                and start interacting.
              </p>
            </div>
          ) : (
            rows.map((course) => {
              return (
                <div
                  key={course.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: COURSE_GRID,
                    alignItems: "center",
                    height: 52,
                    padding: "0 10px",
                    borderTop: `1px solid ${LINE}`,
                    background: "#fff",
                    fontSize: 13.5,
                    color: TEXT,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                    <span
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 8,
                        background: "linear-gradient(135deg,#f0559a,#f7a93b)",
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flex: "0 0 auto",
                      }}
                    >
                      {course.code.slice(0, 1)}
                    </span>
                    {/* The name is the entry point to the course's information.
                        Styled as a link so it reads as interactive: the code is
                        accent-coloured and always underlined, and the title
                        darkens on hover. A button, not an anchor, because it
                        opens a dialog rather than navigating. */}
                    <button
                      type="button"
                      onClick={() => setInfoCourseId(course.id)}
                      title={`Course information for ${course.code}`}
                      className="mfp-course-link"
                      style={{
                        minWidth: 0,
                        padding: 0,
                        border: 0,
                        background: "transparent",
                        textAlign: "left",
                        cursor: "pointer",
                        font: "inherit",
                      }}
                    >
                      <span
                        style={{
                          display: "block",
                          fontWeight: 600,
                          color: "#1f56b8",
                          textDecoration: "underline",
                          textUnderlineOffset: 2,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {course.code}
                      </span>
                      <span
                        className="mfp-course-link-title"
                        style={{
                          display: "block",
                          color: TERT,
                          fontSize: 12,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {course.title}
                      </span>
                    </button>
                  </div>
                  <span>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "3px 9px",
                        borderRadius: 6,
                        background: "#e8f7ee",
                        color: "#1f8a4c",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      Active
                    </span>
                  </span>
                  <span style={{ color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {course.teacher_name ?? <span style={{ color: TERT }}>Unassigned</span>}
                  </span>
                  <span style={{ color: MUTED }}>{course.enrolled_students}</span>
                  <span style={{ color: MUTED }}>
                    {course.documents ?? 0}
                    {(course.documents ?? 0) > 0 && (
                      <span style={{ color: TERT, fontSize: 11 }}> ({course.documents_ready ?? 0} ready)</span>
                    )}
                  </span>
                  <span style={{ color: MUTED }}>{fmtDate(course.created_at)}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      title={`Manage students in ${course.code}`}
                      onClick={() => {
                        setEnrollCourse({ id: course.id, label: `${course.code} — ${course.title}` })
                      }}
                      style={{
                        height: 28,
                        padding: "0 10px",
                        borderRadius: 8,
                        border: `1px solid ${LINE}`,
                        background: "#fff",
                        color: MUTED,
                        fontSize: 12,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Students ({course.enrolled_students})
                    </button>
                    <button
                      type="button"
                      title={`Weekly schedule for ${course.code}`}
                      onClick={() =>
                        setScheduleCourse({ id: course.id, label: `${course.code} — ${course.title}` })
                      }
                      style={{
                        height: 28,
                        padding: "0 10px",
                        borderRadius: 8,
                        border: `1px solid ${LINE}`,
                        background: "#fff",
                        color: MUTED,
                        fontSize: 12,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Schedule{course.sections > 0 ? ` (${course.sections})` : ""}
                    </button>
                    <button
                      type="button"
                      title={`Edit ${course.code}`}
                      onClick={() => setEditingCourse(toFormValues(course))}
                      style={{
                        height: 28,
                        padding: "0 10px",
                        borderRadius: 8,
                        border: `1px solid ${LINE}`,
                        background: "#fff",
                        color: MUTED,
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      Edit
                    </button>
                  </span>
                </div>
              )
            })
          )}
          </div>
        </div>

        {/* footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "14px 4px",
            color: TERT,
            fontSize: 13,
          }}
        >
          <button type="button" disabled style={pagerBtn(true)} aria-label="First page">
            «
          </button>
          <button type="button" disabled style={pagerBtn(true)} aria-label="Previous page">
            ‹
          </button>
          <span
            style={{
              minWidth: 30,
              height: 30,
              borderRadius: 8,
              border: `1px solid ${LINE}`,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: TEXT,
              fontWeight: 600,
              background: "#fff",
            }}
          >
            1
          </span>
          <button type="button" disabled style={pagerBtn(true)} aria-label="Next page">
            ›
          </button>
          <button type="button" disabled style={pagerBtn(true)} aria-label="Last page">
            »
          </button>

          <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 8, color: TEXT, fontWeight: 600 }}>
            50 Rows per page
            <button
              type="button"
              aria-label="Rows per page"
              style={{
                width: 30,
                height: 30,
                borderRadius: 999,
                border: `1px solid ${LINE}`,
                background: "#fff",
                color: TEXT,
                cursor: "pointer",
              }}
            >
              ⌄
            </button>
          </span>
        </div>
      </div>

      <CourseDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        course={null}
        onSaved={() => void load()}
      />

      <CourseDialog
        open={Boolean(editingCourse)}
        onOpenChange={(open) => {
          if (!open) setEditingCourse(null)
        }}
        course={editingCourse}
        onSaved={() => void load()}
      />

      <EnrollStudentsDialog
        open={Boolean(enrollCourse)}
        onOpenChange={(open) => {
          if (!open) setEnrollCourse(null)
        }}
        courseId={enrollCourse?.id ?? null}
        courseLabel={enrollCourse?.label ?? ""}
        onChanged={() => void load()}
      />

      <CourseInfoDialog
        open={Boolean(infoCourseId)}
        onOpenChange={(open) => {
          if (!open) setInfoCourseId(null)
        }}
        courseId={infoCourseId}
      />

      <CourseScheduleDialog
        open={Boolean(scheduleCourse)}
        onOpenChange={(open) => {
          if (!open) setScheduleCourse(null)
        }}
        courseId={scheduleCourse?.id ?? null}
        courseLabel={scheduleCourse?.label ?? ""}
        onSaved={() => void load()}
      />
    </div>
  )
}

function pagerBtn(disabled: boolean): React.CSSProperties {
  return {
    width: 30,
    height: 30,
    borderRadius: 8,
    border: "1px solid transparent",
    background: "transparent",
    color: disabled ? "#c9cddb" : MUTED,
    cursor: disabled ? "default" : "pointer",
  }
}
