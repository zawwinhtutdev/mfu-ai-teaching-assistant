"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  CourseFormPanel,
  normalizeCourseSemester,
  type CourseFormPanelHandle,
  type CourseFormValues,
} from "@/components/admin/course-dialog"
import { CourseSchedulePanel, type CourseSchedulePanelHandle } from "@/components/admin/course-schedule-dialog"
import { Loader2 } from "lucide-react"

const LINE = "#eff1f6"
const TEXT = "#232334"
const MUTED = "#666b80"
const TERT = "#8d92a6"

interface ApiCourseRow {
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
  teachers?: Array<{ id: string; full_name: string | null; email: string }>
  enrolled_students: number
  documents: number
  documents_ready: number
  sections: number
  created_at: string
}

function toFormValues(course: ApiCourseRow): CourseFormValues {
  return {
    id: course.id,
    code: course.code,
    title: course.title,
    description: course.description ?? "",
    semester: normalizeCourseSemester(course.semester),
    academicYear: course.academic_year ?? "",
    school: course.school ?? "",
    furtherInformation: course.further_information ?? "",
    teacherId: course.teacher_id,
    teacherEmails:
      course.teachers && course.teachers.length > 0
        ? course.teachers.map((teacher) => teacher.email)
        : course.teacher_email
          ? [course.teacher_email]
          : [],
  }
}

function sectionCardStyle(): React.CSSProperties {
  return {
    border: `1px solid ${LINE}`,
    borderRadius: 12,
    background: "#fff",
    padding: 16,
    marginBottom: 20,
  }
}

function sectionTitleStyle(): React.CSSProperties {
  return {
    margin: "0 0 16px",
    paddingBottom: 12,
    borderBottom: `2px solid ${TEXT}`,
    fontSize: 17,
    fontWeight: 700,
    color: TEXT,
    letterSpacing: "-0.02em",
  }
}

export function AdminCourseDetail({ courseId }: { courseId: string }) {
  const [course, setCourse] = useState<ApiCourseRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const courseFormRef = useRef<CourseFormPanelHandle>(null)
  const scheduleRef = useRef<CourseSchedulePanelHandle>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [listRes, detailRes] = await Promise.all([
        fetch("/api/admin/courses", { cache: "no-store" }),
        fetch(`/api/admin/courses?courseId=${encodeURIComponent(courseId)}`, { cache: "no-store" }),
      ])
      const listData = await listRes.json()
      const detailData = await detailRes.json()
      if (!detailRes.ok) throw new Error(detailData?.error || "Could not load the course")

      const row = (listData?.courses as ApiCourseRow[] | undefined)?.find((c) => c.id === courseId)
      const detail = detailData?.course as ApiCourseRow | undefined
      if (!detail) throw new Error("Course not found")

      const sectionCount = Array.isArray(detailData?.sections) ? detailData.sections.length : 0

      setCourse(
        row
          ? { ...detail, ...row, sections: sectionCount }
          : {
              ...detail,
              teacher_name: null,
              teacher_email: null,
              enrolled_students: 0,
              documents: 0,
              documents_ready: 0,
              sections: sectionCount,
            },
      )
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not load the course")
      setCourse(null)
    } finally {
      setLoading(false)
    }
  }, [courseId])

  useEffect(() => {
    void load()
  }, [load])

  const formValues = useMemo(() => (course ? toFormValues(course) : null), [course])

  const saveCourse = useCallback(async () => {
    setSaving(true)
    setSaveMessage(null)
    try {
      await courseFormRef.current?.save()
      await scheduleRef.current?.save()
      await load()
      setSaveMessage("Course saved.")
    } catch (cause: unknown) {
      setSaveMessage(cause instanceof Error ? cause.message : "Could not save the course")
    } finally {
      setSaving(false)
    }
  }, [load])

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}>
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: TERT }} />
      </div>
    )
  }

  if (error || !course || !formValues) {
    return (
      <div style={{ maxWidth: 480 }}>
        <Link href="/admin/dashboard" style={{ fontSize: 13, color: MUTED, textDecoration: "none" }}>
          ← Back to courses
        </Link>
        <p style={{ marginTop: 16, color: "#b42318", fontSize: 14 }}>{error || "Course not found"}</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 920, paddingBottom: 88 }}>
      <Link
        href="/admin/dashboard"
        style={{ display: "inline-block", marginBottom: 16, fontSize: 13, color: MUTED, textDecoration: "none" }}
      >
        ← Back to courses
      </Link>

      <header style={{ marginBottom: 24 }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "6px 12px",
            marginBottom: 14,
          }}
        >
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: TEXT, letterSpacing: "-0.02em" }}>
            {course.code}
          </h1>
          <span style={{ color: LINE, fontSize: 20, fontWeight: 300, userSelect: "none" }} aria-hidden>
            |
          </span>
          <p
            style={{
              margin: 0,
              flex: "1 1 12rem",
              minWidth: 0,
              fontSize: 18,
              fontWeight: 500,
              color: MUTED,
              lineHeight: 1.35,
            }}
          >
            {course.title}
          </p>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              marginLeft: "auto",
              padding: "5px 11px",
              borderRadius: 999,
              background: "#e8f7ee",
              color: "#1f8a4c",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              flexShrink: 0,
            }}
          >
            Active
          </span>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "stretch",
            gap: 8,
            padding: 12,
            borderRadius: 12,
            border: `1px solid ${LINE}`,
            background: "linear-gradient(180deg, #fafbfe 0%, #f4f6fa 100%)",
          }}
        >
          {[
            { label: "Teacher", value: course.teacher_name ?? "Unassigned" },
            { label: "Students", value: String(course.enrolled_students) },
            { label: "Documents", value: String(course.documents) },
            { label: "Sections", value: String(course.sections) },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                flex: "1 1 7.5rem",
                minWidth: 100,
                padding: "10px 12px",
                borderRadius: 10,
                border: `1px solid ${LINE}`,
                background: "#fff",
                boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: TERT,
                  marginBottom: 4,
                }}
              >
                {stat.label}
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: TEXT,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={stat.value}
              >
                {stat.value}
              </div>
            </div>
          ))}
        </div>
      </header>

      <section style={sectionCardStyle()}>
        <h2 style={sectionTitleStyle()}>Course details</h2>
        <CourseFormPanel
          ref={courseFormRef}
          course={formValues}
          showActions={false}
          onSaved={() => {}}
          idPrefix={`course-${course.id}`}
        />
      </section>

      <section style={sectionCardStyle()}>
        <h2 style={sectionTitleStyle()}>Class sections</h2>
        <CourseSchedulePanel
          ref={scheduleRef}
          courseId={course.id}
          showSaveButton={false}
          onSaved={() => {}}
          onEnrollmentChanged={() => void load()}
        />
      </section>

      {saveMessage ? (
        <div
          role="status"
          style={{
            position: "fixed",
            right: 24,
            bottom: 84,
            zIndex: 29,
            maxWidth: 320,
            padding: "10px 14px",
            borderRadius: 10,
            border: `1px solid ${LINE}`,
            background: "#fff",
            boxShadow: "0 4px 16px rgba(16, 18, 28, 0.12)",
            fontSize: 13,
            color: saveMessage === "Course saved." ? "#1f8a4c" : "#b42318",
          }}
        >
          {saveMessage}
        </div>
      ) : null}

      <button
        type="button"
        disabled={saving}
        onClick={() => void saveCourse()}
        style={{
          position: "fixed",
          right: 24,
          bottom: 24,
          zIndex: 30,
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          height: 44,
          padding: "0 22px",
          borderRadius: 999,
          border: "none",
          background: TEXT,
          color: "#fff",
          fontSize: 14,
          fontWeight: 600,
          whiteSpace: "nowrap",
          cursor: saving ? "default" : "pointer",
          opacity: saving ? 0.85 : 1,
          boxShadow: "0 6px 20px rgba(16, 18, 28, 0.28)",
        }}
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {saving ? "Saving…" : "Save course"}
      </button>
    </div>
  )
}