import { NextResponse } from "next/server"

import { resolvePrincipal, clientForPrincipal, assertCourseAccess } from "@/lib/server/principal"

/**
 * Class schedules for the caller's courses.
 *
 * Returns every section whose timetable parses, across all courses the caller
 * may see — a teacher's own courses, or a student's enrolments. The calendar
 * expands these into weekly occurrences for whichever month it is showing.
 *
 * `unparsed` lists sections whose timetable text could not be understood, so a
 * typo in an admin-entered timetable is visible rather than silently missing.
 */
export async function GET() {
  try {
    const principal = await resolvePrincipal()
    if (!principal) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = await clientForPrincipal(principal)

    // Which courses may this caller see?
    let courseRows: Array<{ id: string; code: string; title: string }> = []

    if (principal.role === "admin") {
      const { data } = await supabase.from("courses").select("id, code, title")
      courseRows = data ?? []
    } else if (principal.role === "teacher") {
      if (!principal.isPersistable) {
        return NextResponse.json({ sessions: [], unparsed: [] })
      }
      const { data } = await supabase
        .from("courses")
        .select("id, code, title")
        .eq("teacher_id", principal.userId)
      courseRows = data ?? []
    } else {
      if (!principal.isPersistable) {
        return NextResponse.json({ sessions: [], unparsed: [] })
      }
      const { data: enrollments } = await supabase
        .from("course_enrollments")
        .select("course_id")
        .eq("student_id", principal.userId)

      const ids = (enrollments ?? []).map((row: any) => row.course_id).filter(Boolean)
      if (ids.length > 0) {
        const { data } = await supabase
          .from("courses")
          .select("id, code, title")
          .in("id", ids)
        courseRows = data ?? []
      }
    }

    if (courseRows.length === 0) {
      return NextResponse.json({ sessions: [], unparsed: [] })
    }

    const courseById = new Map(courseRows.map((course) => [course.id, course]))

    const { data: sections, error } = await supabase
      .from("course_sections")
      .select("id, course_id, section_no, section_type, timetable, room")
      .in("course_id", courseRows.map((course) => course.id))
      .order("section_no")

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const { parseTimetable } = await import("@/lib/course-schedule")

    const sessions: any[] = []
    const unparsed: any[] = []

    for (const section of sections ?? []) {
      const course = courseById.get(section.course_id)
      if (!course) continue

      const schedule = parseTimetable(section.timetable)
      if (!schedule) {
        unparsed.push({
          courseCode: course.code,
          sectionNo: section.section_no,
          timetable: section.timetable,
        })
        continue
      }

      sessions.push({
        courseId: course.id,
        courseCode: course.code,
        courseTitle: course.title,
        sectionNo: section.section_no,
        sectionType: section.section_type,
        room: section.room,
        weekday: schedule.weekday,
        startHour: schedule.startHour,
        endHour: schedule.endHour,
        raw: schedule.raw,
      })
    }

    return NextResponse.json({ sessions, unparsed })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to load schedules" }, { status: 500 })
  }
}
