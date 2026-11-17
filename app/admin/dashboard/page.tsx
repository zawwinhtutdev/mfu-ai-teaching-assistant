"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { ApiCourse } from "@/lib/server/academic"

const LINE = "#eff1f6"
const TEXT = "#232334"
const MUTED = "#666b80"
const TERT = "#8d92a6"

function fmtDate(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })
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
  const [selected, setSelected] = useState<Set<string>>(new Set())

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
      const hay = `${c.code} ${c.title} ${c.teacher_name ?? ""}`.toLowerCase()
      return !q || hay.includes(q)
    })
  }, [courses, query])

  const allSelected = rows.length > 0 && rows.every((c) => selected.has(c.id))

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(rows.map((c) => c.id)))
  }

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div>
      {/* page head */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: TEXT, margin: 0 }}>Manage courses</h1>
        <span
          style={{
            minWidth: 22,
            height: 22,
            padding: "0 7px",
            borderRadius: 6,
            background: "#f4f6fa",
            color: TERT,
            fontSize: 13,
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {courses.length}
        </span>
        <button
          type="button"
          onClick={() => void load()}
          aria-label="Refresh"
          style={{
            width: 34,
            height: 34,
            borderRadius: 999,
            border: "none",
            background: "transparent",
            color: MUTED,
            cursor: "pointer",
            fontSize: 16,
          }}
        >
          ⟳
        </button>

        <div style={{ marginLeft: "auto", position: "relative", width: 240 }}>
          <span style={{ position: "absolute", left: 14, top: 11, color: TERT, fontSize: 14 }}>⌕</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            aria-label="Search courses"
            style={{
              width: "100%",
              height: 40,
              padding: "0 14px 0 34px",
              borderRadius: 999,
              border: `1px solid ${LINE}`,
              background: "#fff",
              fontSize: 14,
              color: TEXT,
              outline: "none",
            }}
          />
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
        <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, overflow: "hidden", background: "#fff" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "44px 1.6fr 110px 1.1fr 120px 110px 130px 96px",
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
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              aria-label="Select all courses"
              style={{ accentColor: TEXT }}
            />
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
              const isSel = selected.has(course.id)
              return (
                <div
                  key={course.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "44px 1.6fr 110px 1.1fr 120px 110px 130px 96px",
                    alignItems: "center",
                    height: 52,
                    padding: "0 10px",
                    borderTop: `1px solid ${LINE}`,
                    background: isSel ? "#fafbff" : "#fff",
                    fontSize: 13.5,
                    color: TEXT,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSel}
                    onChange={() => toggleOne(course.id)}
                    aria-label={`Select ${course.code}`}
                    style={{ accentColor: TEXT }}
                  />
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
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: "block", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {course.code}
                      </span>
                      <span style={{ display: "block", color: TERT, fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {course.title}
                      </span>
                    </span>
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
                    {course.teacher_name ?? "—"}
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
                      title={`Open ${course.code}`}
                      onClick={() => window.open(`/teacherportal/mycourses/${course.id}`, "_blank")}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        border: `1px solid ${LINE}`,
                        background: "#fff",
                        color: MUTED,
                        cursor: "pointer",
                      }}
                    >
                      ↗
                    </button>
                    <button
                      type="button"
                      title="More"
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        border: `1px solid ${LINE}`,
                        background: "#fff",
                        color: MUTED,
                        cursor: "pointer",
                      }}
                    >
                      ⋯
                    </button>
                  </span>
                </div>
              )
            })
          )}
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
